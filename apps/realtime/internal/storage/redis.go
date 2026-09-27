package storage

import (
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/mockinterviewai/realtime/internal/config"
	redis "github.com/redis/go-redis/v9"
)

// Broadcaster интерфейс для распределенной рассылки событий между репликами сервиса.
type Broadcaster interface {
	Publish(ctx context.Context, sessionID string, data []byte) error
	Subscribe(ctx context.Context, sessionID string, onMessage func(data []byte)) (func(), error)
	SubscribeRevocations(ctx context.Context, onRevoke func(userID, sessionID string)) (func(), error)
	RevokeUser(ctx context.Context, userID string) error
	InstanceID() string
}

// SessionStore интерфейс для проверки состояния токенов, сессий, ролей участников и персистентности кода в Redis.
type SessionStore interface {
	IsTokenRevoked(ctx context.Context, tokenID string) (bool, error)
	IsSessionActive(ctx context.Context, sessionID string) (bool, error)
	GetSessionUserRole(ctx context.Context, sessionID, userID string) (string, error)
	IsAuthSessionActive(ctx context.Context, sid string) (bool, error)
	CheckMinGeneration(ctx context.Context, userID string, generation int) (bool, error)
	ConsumeTicket(ctx context.Context, tokenID string) (bool, error)
	TouchMirror(ctx context.Context, sessionID string, ttl time.Duration) error
	NextCodeVersion(ctx context.Context, sessionID string) (int64, error)
	SaveCodeState(ctx context.Context, sessionID string, data []byte) error
	GetCodeState(ctx context.Context, sessionID string) ([]byte, error)
	Ping(ctx context.Context) error
	Close() error
}

// YjsDocStore интерфейс для работы со стримами и сидингом CRDT-документов Yjs в Redis.
type YjsDocStore interface {
	SeedTaskDoc(ctx context.Context, sessionID, taskKey, starterUpdateBase64 string, ttlSeconds int64) (int, error)
	GetTaskUpdates(ctx context.Context, sessionID, taskKey string) ([]string, error)
	AppendTaskUpdate(ctx context.Context, sessionID, taskKey, updateBase64 string) (string, error)
	CompactTaskStream(ctx context.Context, sessionID, taskKey, snapshotBase64 string) error
	TouchTaskStream(ctx context.Context, sessionID, taskKey string, ttl time.Duration) error
}

// PubSubMessage обертка над сообщением для предотвращения эхо-повторов на одном и том же сервере.
type PubSubMessage struct {
	InstanceID string `json:"instanceId"`
	Data       []byte `json:"data"`

	// SentAt — время публикации в Unix-миллисекундах. Используется для
	// измерения задержки релея событий комнат через Redis Pub/Sub
	// (метрика realtime_ws_pubsub_lag_seconds). 0 — у старых продюсеров,
	// в этом случае задержка не измеряется.
	SentAt int64 `json:"sentAt,omitempty"`
}

// RevocationMessage описывает сообщение ревокации из канала "auth:revocations"
// (формат Phase A, публикует apps/api):
//
//	{"instanceId":"api-<hostname>","data":"<userId>","sessionId":"<id>"}
//
// sessionId заполняется только при room-scoped evict (close-сессии, P2).
type RevocationMessage struct {
	InstanceID string `json:"instanceId"`
	Data       string `json:"data"`
	SessionID  string `json:"sessionId"`
}

// parseRevocation разбирает payload сообщения канала "auth:revocations".
//
// Возвращает (userID, sessionID). Для старых сообщений формата
// {"userId":..,"reason":..} (их API больше не публикует) возвращает ("","") —
// такие сообщения игнорируются.
func parseRevocation(payload []byte) (userID, sessionID string) {
	var msg RevocationMessage
	if err := json.Unmarshal(payload, &msg); err != nil {
		return "", ""
	}
	return strings.TrimSpace(msg.Data), strings.TrimSpace(msg.SessionID)
}

// isActiveValue интерпретирует значение ключа "session:<id>:active".
// Сессия активна только при значении "true" (fail-closed: всё прочее — нет).
func isActiveValue(val string) bool {
	return strings.TrimSpace(val) == "true"
}

// isMemberValue интерпретирует значение поля участника в "session:<id>:members".
// Пустое/пробельное значение означает отсутствие членства (нет роли).
func isMemberValue(val string) bool {
	return strings.TrimSpace(val) != ""
}

// RedisStore объединяет SessionStore и Broadcaster на базе Redis.
type RedisStore struct {
	client     *redis.Client
	instanceID string
	logger     *slog.Logger
	enabled    bool

	// onPubSubLag — наблюдатель задержки релея событий комнат через Redis
	// Pub/Sub (PLAN шаг 9). Устанавливается из main.go и привязан к ws-метрикам.
	onPubSubLag func(seconds float64)
}

// NewRedisStore создает подключение к Redis. Если Redis выключен или недоступен, работает в no-op безопасном режиме.
func NewRedisStore(cfg *config.Config, logger *slog.Logger) *RedisStore {
	instanceID := "inst-" + uuid.NewString()[:8]

	if !cfg.RedisEnabled {
		logger.Info("redis is disabled, running with local in-memory broadcaster")
		return &RedisStore{
			enabled:    false,
			instanceID: instanceID,
			logger:     logger.With(slog.String("component", "redis")),
		}
	}

	opts, err := redis.ParseURL(cfg.RedisAddr)
	if err != nil {
		opts = &redis.Options{
			Addr:         cfg.RedisAddr,
			Password:     cfg.RedisPassword,
			DB:           cfg.RedisDB,
			DialTimeout:  5 * time.Second,
			ReadTimeout:  3 * time.Second,
			WriteTimeout: 3 * time.Second,
		}
	}

	// REDIS_URL без учетных данных (redis://host:port/db) парсится успешно и
	// возвращает пустой пароль, поэтому REDIS_PASSWORD нужно применить явно:
	// иначе он молча игнорируется и сервис уходит в soft-fail с NOAUTH.
	if opts.Password == "" && cfg.RedisPassword != "" {
		opts.Password = cfg.RedisPassword
	}

	// Каждый пользователь с открытым SSE-потоком удерживает одно соединение
	// пула на блокирующем XREAD, поэтому пул расширяется явно.
	if cfg.RedisPoolSize > 0 {
		opts.PoolSize = cfg.RedisPoolSize
	}

	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	safeAddr := redactRedisAddr(cfg.RedisAddr)

	if err := client.Ping(ctx).Err(); err != nil {
		logger.Warn("failed to ping redis on startup, proceeding in soft-fail mode",
			slog.String("addr", safeAddr),
			slog.String("error", err.Error()),
		)
	} else {
		logger.Info("connected to redis successfully",
			slog.String("addr", safeAddr),
			slog.String("instanceId", instanceID),
		)
	}

	return &RedisStore{
		client:     client,
		instanceID: instanceID,
		logger:     logger.With(slog.String("component", "redis")),
		enabled:    true,
	}
}

// redactRedisAddr убирает учетные данные из строки подключения перед записью
// в лог: REDIS_URL вида "redis://:password@host:6379/0" иначе утек бы паролем
// в агрегатор логов на уровне INFO.
func redactRedisAddr(addr string) string {
	scheme, rest, hasScheme := strings.Cut(addr, "://")
	if !hasScheme {
		// Формат "host:port" учетных данных не содержит.
		return addr
	}

	credentials, hostPart, hasCredentials := strings.Cut(rest, "@")
	if !hasCredentials {
		return addr
	}

	user, _, _ := strings.Cut(credentials, ":")

	return scheme + "://" + user + ":***@" + hostPart
}

// InstanceID возвращает уникальный ID текущего инстанса сервиса.
func (r *RedisStore) InstanceID() string {
	return r.instanceID
}

// RedisPoolStats — снимок состояния пула соединений Redis (уплощенная проекция
// redis.PoolStats). Импорт go-redis для этого в месте экспорта метрик не нужен.
type RedisPoolStats struct {
	TotalConns int
	IdleConns  int
	StaleConns int
	Hits       int64
	Misses     int64
	Timeouts   int64
}

// PoolStats возвращает статистику пула соединений клиента Redis. Возвращает nil
// в disabled-режиме (клиент не создан — пула не существует). Hits/Misses/Timeouts
// и StaleConns кумулятивны с момента создания клиента, поэтому экспортируются
// как счетчики.
func (r *RedisStore) PoolStats() *RedisPoolStats {
	if !r.Enabled() {
		return nil
	}

	ps := r.client.PoolStats()
	return &RedisPoolStats{
		TotalConns: int(ps.TotalConns),
		IdleConns:  int(ps.IdleConns),
		StaleConns: int(ps.StaleConns),
		Hits:       int64(ps.Hits),
		Misses:     int64(ps.Misses),
		Timeouts:   int64(ps.Timeouts),
	}
}

// SetPubSubLagObserver регистрирует наблюдателя задержки релея событий комнат
// через Redis Pub/Sub. No-op, если регистрируется nil.
func (r *RedisStore) SetPubSubLagObserver(observe func(seconds float64)) {
	if observe == nil {
		return
	}
	r.onPubSubLag = observe
}

// observePubSubLag передает замер задержки наблюдателю, если он зарегистрирован.
func (r *RedisStore) observePubSubLag(sentAtMillis int64) {
	if r.onPubSubLag == nil || sentAtMillis <= 0 {
		return
	}

	lag := time.Since(time.UnixMilli(sentAtMillis)).Seconds()
	if lag < 0 {
		return
	}
	r.onPubSubLag(lag)
}

// Publish публикует событие в канал Redis для всех реплик.
func (r *RedisStore) Publish(ctx context.Context, sessionID string, data []byte) error {
	if !r.enabled || r.client == nil {
		return nil
	}

	payload, err := json.Marshal(PubSubMessage{
		InstanceID: r.instanceID,
		Data:       data,
		SentAt:     time.Now().UnixMilli(),
	})
	if err != nil {
		return fmt.Errorf("failed to marshal pubsub message: %w", err)
	}

	channel := fmt.Sprintf("session:%s:events", sessionID)
	return r.client.Publish(ctx, channel, payload).Err()
}

// Subscribe подписывается на события комнаты из Redis и передает их в обработчик.
func (r *RedisStore) Subscribe(ctx context.Context, sessionID string, onMessage func(data []byte)) (func(), error) {
	if !r.enabled || r.client == nil {
		return func() {}, nil
	}

	channel := fmt.Sprintf("session:%s:events", sessionID)
	pubsub := r.client.Subscribe(ctx, channel)

	subCtx, cancel := context.WithCancel(ctx)

	go func() {
		defer func() {
			_ = pubsub.Close()
		}()
		ch := pubsub.Channel()

		for {
			select {
			case <-subCtx.Done():
				return
			case msg, ok := <-ch:
				if !ok {
					return
				}

				var wrapped PubSubMessage
				if err := json.Unmarshal([]byte(msg.Payload), &wrapped); err != nil {
					continue
				}

				// Игнорируем сообщения, отправленные этим же инстансом (уже разосланы локально)
				if wrapped.InstanceID == r.instanceID {
					continue
				}

				// Замер задержки релея событий комнат через Pub/Sub (PLAN шаг 9).
				r.observePubSubLag(wrapped.SentAt)

				onMessage(wrapped.Data)
			}
		}
	}()

	unsubscribe := func() {
		cancel()
		_ = pubsub.Close()
	}

	return unsubscribe, nil
}

// RevokeUser публикует сигнал отзыва токена/сессии пользователя в глобальный Redis-канал "auth:revocations".
func (r *RedisStore) RevokeUser(ctx context.Context, userID string) error {
	if !r.enabled || r.client == nil || userID == "" {
		return nil
	}

	payload, err := json.Marshal(PubSubMessage{
		InstanceID: r.instanceID,
		Data:       []byte(userID),
		SentAt:     time.Now().UnixMilli(),
	})
	if err != nil {
		return fmt.Errorf("failed to marshal revocation message: %w", err)
	}

	return r.client.Publish(ctx, "auth:revocations", payload).Err()
}

// SubscribeRevocations подписывается на глобальные сигналы отзыва авторизации пользователей.
func (r *RedisStore) SubscribeRevocations(ctx context.Context, onRevoke func(userID, sessionID string)) (func(), error) {
	if !r.enabled || r.client == nil {
		return func() {}, nil
	}

	pubsub := r.client.Subscribe(ctx, "auth:revocations")
	subCtx, cancel := context.WithCancel(ctx)

	go func() {
		defer func() {
			_ = pubsub.Close()
		}()
		ch := pubsub.Channel()

		for {
			select {
			case <-subCtx.Done():
				return
			case msg, ok := <-ch:
				if !ok {
					return
				}

				userID, sessionID := parseRevocation([]byte(msg.Payload))
				if userID == "" {
					continue
				}
				onRevoke(userID, sessionID)
			}
		}
	}()

	unsubscribe := func() {
		cancel()
		_ = pubsub.Close()
	}

	return unsubscribe, nil
}

// IsTokenRevoked проверяет, не отозван ли токен (blacklist в Redis: key "blacklist:token:<id>").
func (r *RedisStore) IsTokenRevoked(ctx context.Context, tokenID string) (bool, error) {
	if !r.enabled || r.client == nil || tokenID == "" {
		return false, nil
	}

	key := fmt.Sprintf("blacklist:token:%s", tokenID)
	exists, err := r.client.Exists(ctx, key).Result()
	if err != nil {
		r.logger.Warn("failed to check token blacklist in redis", slog.String("error", err.Error()))
		return false, nil
	}

	return exists > 0, nil
}

// IsSessionActive проверяет активность сессии в Redis: key "session:<id>:active".
//
// Fail-closed (Phase B2): отсутствие ключа (redis.Nil), ошибка Redis или
// disabled-режим возвращают `false` — подключение отклоняется, а не допускается.
func (r *RedisStore) IsSessionActive(ctx context.Context, sessionID string) (bool, error) {
	if !r.enabled || r.client == nil || sessionID == "" {
		return false, nil
	}

	key := fmt.Sprintf("session:%s:active", sessionID)
	val, err := r.client.Get(ctx, key).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return false, nil
		}
		r.logger.Warn("failed to check session active in redis", slog.String("error", err.Error()))
		return false, nil
	}

	return isActiveValue(val), nil
}

// GetSessionUserRole получает проверенную роль пользователя в сессии из Redis (Hash: key "session:<id>:members").
//
// Отсутствие поля/ключа или disabled-режим возвращают ("", nil) — сигнал
// "нет членства". Ошибка Redis пробрасывается наверх.
func (r *RedisStore) GetSessionUserRole(ctx context.Context, sessionID, userID string) (string, error) {
	if !r.enabled || r.client == nil || sessionID == "" || userID == "" {
		return "", nil
	}

	key := fmt.Sprintf("session:%s:members", sessionID)
	role, err := r.client.HGet(ctx, key, userID).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return "", nil
		}
		r.logger.Warn("failed to fetch user role from redis session members",
			slog.String("sessionId", sessionID),
			slog.String("userId", userID),
			slog.String("error", err.Error()),
		)
		return "", err
	}

	return role, nil
}

// IsAuthSessionActive проверяет живую auth-сессию API: EXISTS "auth:session:{sid}".
//
// Fail-closed (A6/P12): отсутствие/ошибка/disabled → false. Симметрично
// live-проверке AccessTokenGuard в API.
func (r *RedisStore) IsAuthSessionActive(ctx context.Context, sid string) (bool, error) {
	if !r.enabled || r.client == nil || sid == "" {
		return false, nil
	}

	key := fmt.Sprintf("auth:session:%s", sid)
	exists, err := r.client.Exists(ctx, key).Result()
	if err != nil {
		r.logger.Warn("failed to check auth session active in redis", slog.String("error", err.Error()))
		return false, nil
	}

	return exists > 0, nil
}

// ErrRedisUnavailable возвращается security-критичными методами при недоступном Redis
// или отключённом клиенте (fail-closed режим, §CWE-613).
var ErrRedisUnavailable = errors.New("redis unavailable")

// CheckMinGeneration проверяет, удовлетворяет ли generation токена минимальному активному поколению
// пользователя в Redis (ключ "auth:user:<userId>:min_generation", §CWE-613).
//
// Fail-closed: при недоступном Redis или nil-клиенте возвращает (false, ErrRedisUnavailable),
// чтобы SSE и WebSocket хендлеры завершили запрос с 401 вместо пропуска проверки.
//
// Если min_generation не установлен (redis.Nil), ключ ещё не записан — токен считается
// действительным (true, nil): ключ появляется только при отзыве сессий.
// Если generation < min_generation, возвращает (false, nil).
// При ошибке Redis (не Nil) логирует и возвращает (false, err).
func (r *RedisStore) CheckMinGeneration(ctx context.Context, userID string, generation int) (bool, error) {
	if !r.enabled || r.client == nil {
		r.logger.Warn("CheckMinGeneration: redis unavailable, rejecting (fail-closed)",
			slog.String("userId", userID),
		)
		return false, ErrRedisUnavailable
	}
	if userID == "" {
		return false, errors.New("CheckMinGeneration: empty userID")
	}

	key := fmt.Sprintf("auth:user:%s:min_generation", userID)
	val, err := r.client.Get(ctx, key).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return true, nil
		}
		r.logger.Warn("failed to check min generation in redis",
			slog.String("userId", userID),
			slog.String("error", err.Error()),
		)
		return false, err
	}

	minGen, err := strconv.Atoi(strings.TrimSpace(val))
	if err != nil {
		r.logger.Warn("invalid min generation value in redis",
			slog.String("userId", userID),
			slog.String("val", val),
			slog.String("error", err.Error()),
		)
		return false, nil
	}

	return generation >= minGen, nil
}

// ConsumeTicket атомарно помечает одноразовый тикет использованным:
// SET "ticket:consumed:<jti>" EX <ttl> NX. Возвращает true, если тикет
// использован впервые (ключ установлен), false — повторное использование.
//
// Отдельный namespace ticket:consumed:* (не смешивается с blacklist:token:*).
// Fail-closed: при выключенном Redis или пустом tokenID возвращает false.
func (r *RedisStore) ConsumeTicket(ctx context.Context, tokenID string) (bool, error) {
	if !r.enabled || r.client == nil || tokenID == "" {
		return false, nil
	}

	key := fmt.Sprintf("ticket:consumed:%s", tokenID)
	const ttl = 5 * time.Minute
	set, err := r.client.SetNX(ctx, key, "1", ttl).Result()
	if err != nil {
		r.logger.Warn("failed to consume ticket in redis", slog.String("error", err.Error()))
		return false, nil
	}

	return set, nil
}

// TouchMirror продлевает TTL зеркала сессии (active + members) при успешном
// подключении — молчаливое интервью дольше TTL не теряет доступ к реконнектам.
func (r *RedisStore) TouchMirror(ctx context.Context, sessionID string, ttl time.Duration) error {
	if !r.enabled || r.client == nil || sessionID == "" {
		return nil
	}

	activeKey := fmt.Sprintf("session:%s:active", sessionID)
	membersKey := fmt.Sprintf("session:%s:members", sessionID)

	if err := r.client.Expire(ctx, activeKey, ttl).Err(); err != nil {
		return err
	}
	return r.client.Expire(ctx, membersKey, ttl).Err()
}

var (
	nextCodeVersionScript = redis.NewScript(`
		local seqKey = KEYS[1]
		local savedKey = KEYS[2]
		local ttl = tonumber(ARGV[1])

		local seq = redis.call('GET', seqKey)
		local saved = redis.call('GET', savedKey)
		local currentSeq = seq and tonumber(seq) or 0
		local currentSaved = saved and tonumber(saved) or 0

		if currentSaved > currentSeq then
			currentSeq = currentSaved
		end

		local nextVal = currentSeq + 1
		redis.call('SET', seqKey, nextVal, 'EX', ttl)
		return nextVal
	`)

	saveCodeStateScript = redis.NewScript(`
		local codeKey = KEYS[1]
		local savedVersionKey = KEYS[2]
		local data = ARGV[1]
		local newVersion = tonumber(ARGV[2])
		local ttl = tonumber(ARGV[3])

		if newVersion and newVersion > 0 then
			local currentSaved = redis.call('GET', savedVersionKey)
			if currentSaved and tonumber(currentSaved) >= newVersion then
				return 0
			end
			redis.call('SET', savedVersionKey, newVersion, 'EX', ttl)
		end

		redis.call('SET', codeKey, data, 'EX', ttl)
		return 1
	`)
)

// NextCodeVersion атомарно инкрементирует и возвращает глобальный монотонный номер версии кода для сессии в Redis.
func (r *RedisStore) NextCodeVersion(ctx context.Context, sessionID string) (int64, error) {
	if !r.enabled || r.client == nil || sessionID == "" {
		return 0, nil
	}

	seqKey := fmt.Sprintf("session:%s:code:seq", sessionID)
	savedKey := fmt.Sprintf("session:%s:code:saved_version", sessionID)
	const ttlSeconds = int64(24 * 60 * 60) // 24 часа

	res, err := nextCodeVersionScript.Run(ctx, r.client, []string{seqKey, savedKey}, ttlSeconds).Int64()
	if err != nil {
		r.logger.Warn("failed to allocate next code version from redis", slog.String("error", err.Error()))
		return 0, err
	}

	return res, nil
}

// SaveCodeState условно сохраняет снимок кода сессии в Redis (ключ "session:<id>:code" с TTL 24 часа),
// только если версия снимка строго больше уже сохраненной в Redis (защита от race conditions между репликами).
func (r *RedisStore) SaveCodeState(ctx context.Context, sessionID string, data []byte) error {
	if !r.enabled || r.client == nil || sessionID == "" {
		return nil
	}

	var payload struct {
		Version int64 `json:"version"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		r.logger.Warn("failed to parse code snapshot payload, skipping conditional save",
			slog.String("error", err.Error()),
		)
		return fmt.Errorf("invalid code snapshot payload: %w", err)
	}

	codeKey := fmt.Sprintf("session:%s:code", sessionID)
	savedVersionKey := fmt.Sprintf("session:%s:code:saved_version", sessionID)
	const ttlSeconds = int64(24 * 60 * 60) // 24 часа

	return saveCodeStateScript.Run(ctx, r.client, []string{codeKey, savedVersionKey}, data, payload.Version, ttlSeconds).Err()
}

// GetCodeState считывает последний снимок кода сессии из Redis.
func (r *RedisStore) GetCodeState(ctx context.Context, sessionID string) ([]byte, error) {
	if !r.enabled || r.client == nil || sessionID == "" {
		return nil, nil
	}

	key := fmt.Sprintf("session:%s:code", sessionID)
	data, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return nil, nil
		}
		return nil, err
	}

	return data, nil
}

// Ping проверяет состояние соединения с Redis (для /readyz).
func (r *RedisStore) Ping(ctx context.Context) error {
	if !r.enabled || r.client == nil {
		return nil
	}
	return r.client.Ping(ctx).Err()
}

// Close закрывает клиентское соединение с Redis.
func (r *RedisStore) Close() error {
	if r.client != nil {
		return r.client.Close()
	}
	return nil
}

//go:embed scripts/seed_task_doc.lua
var seedTaskDocLua string

var seedTaskDocScript *redis.Script

func init() {
	seedTaskDocScript = redis.NewScript(seedTaskDocLua)
}

// SeedTaskDoc атомарно проверяет и засевает начальный документ Yjs для задачи через seed_task_doc.lua.
// Возвращает код состояния скрипта:
// 0 - No-op (уже засеяно и валидно)
// 1 - Первичный сидинг успешно выполнен
// 2 - Маркер успешно восстановлен без повторного XADD
// 3 - Служебная структура стрима восстановлена со стартовым шаблоном
func (r *RedisStore) SeedTaskDoc(ctx context.Context, sessionID, taskKey, starterUpdateBase64 string, ttlSeconds int64) (int, error) {
	if !r.enabled || r.client == nil || sessionID == "" || taskKey == "" {
		return 0, nil
	}

	keys := []string{
		fmt.Sprintf("{session:%s}:seeded_tasks", sessionID),
		fmt.Sprintf("{session:%s}:task:%s:updates", sessionID, taskKey),
	}

	res, err := seedTaskDocScript.Run(ctx, r.client, keys, taskKey, starterUpdateBase64, ttlSeconds).Int()
	if err != nil {
		r.logger.Warn("failed to execute seed_task_doc.lua in redis",
			slog.String("sessionId", sessionID),
			slog.String("taskKey", taskKey),
			slog.String("error", err.Error()),
		)
		return 0, err
	}

	return res, nil
}

// GetTaskUpdates считывает все сохраненные дельты задачи из Redis Stream ({session:<id>}:task:<taskKey>:updates) через XRANGE.
func (r *RedisStore) GetTaskUpdates(ctx context.Context, sessionID, taskKey string) ([]string, error) {
	if !r.enabled || r.client == nil || sessionID == "" || taskKey == "" {
		return nil, nil
	}

	streamKey := fmt.Sprintf("{session:%s}:task:%s:updates", sessionID, taskKey)
	entries, err := r.client.XRange(ctx, streamKey, "-", "+").Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return nil, nil
		}
		r.logger.Warn("failed to fetch task updates from stream",
			slog.String("sessionId", sessionID),
			slog.String("taskKey", taskKey),
			slog.String("error", err.Error()),
		)
		return nil, err
	}

	updates := make([]string, 0, len(entries))
	for _, entry := range entries {
		if val, ok := entry.Values["data"].(string); ok && val != "" {
			updates = append(updates, val)
		}
	}

	return updates, nil
}

// AppendTaskUpdate записывает очередную дельту Yjs в Redis Stream задачи через XADD.
func (r *RedisStore) AppendTaskUpdate(ctx context.Context, sessionID, taskKey, updateBase64 string) (string, error) {
	if !r.enabled || r.client == nil || sessionID == "" || taskKey == "" || updateBase64 == "" {
		return "", nil
	}

	streamKey := fmt.Sprintf("{session:%s}:task:%s:updates", sessionID, taskKey)
	return r.client.XAdd(ctx, &redis.XAddArgs{
		Stream: streamKey,
		ID:     "*",
		Values: map[string]interface{}{"data": updateBase64},
	}).Result()
}

// CompactTaskStream сохраняет новый snapshot документа в Redis Stream и удаляет устаревшие дельты через XTRIM MINID.
func (r *RedisStore) CompactTaskStream(ctx context.Context, sessionID, taskKey, snapshotBase64 string) error {
	if !r.enabled || r.client == nil || sessionID == "" || taskKey == "" || snapshotBase64 == "" {
		return nil
	}

	streamKey := fmt.Sprintf("{session:%s}:task:%s:updates", sessionID, taskKey)
	// 1. Записываем сжатый snapshot в стрим
	snapshotID, err := r.client.XAdd(ctx, &redis.XAddArgs{
		Stream: streamKey,
		ID:     "*",
		Values: map[string]interface{}{"data": snapshotBase64},
	}).Result()
	if err != nil {
		r.logger.Warn("failed to append snapshot to stream during compaction",
			slog.String("sessionId", sessionID),
			slog.String("taskKey", taskKey),
			slog.String("error", err.Error()),
		)
		return fmt.Errorf("failed to append snapshot to stream: %w", err)
	}

	// 2. Обрезаем стрим так, чтобы snapshotID стал первой записью (XTRIM MINID snapshotID)
	if err := r.client.XTrimMinID(ctx, streamKey, snapshotID).Err(); err != nil {
		r.logger.Warn("failed to trim stream after snapshot",
			slog.String("sessionId", sessionID),
			slog.String("taskKey", taskKey),
			slog.String("snapshotId", snapshotID),
			slog.String("error", err.Error()),
		)
		return fmt.Errorf("failed to trim stream: %w", err)
	}

	return nil
}

// TouchTaskStream синхронно продлевает TTL ключей активной задачи ({session:<id>}:seeded_tasks и стрима задачи) на заданный TTL.
func (r *RedisStore) TouchTaskStream(ctx context.Context, sessionID, taskKey string, ttl time.Duration) error {
	if !r.enabled || r.client == nil || sessionID == "" || taskKey == "" {
		return nil
	}

	pipe := r.client.Pipeline()
	pipe.Expire(ctx, fmt.Sprintf("{session:%s}:seeded_tasks", sessionID), ttl)
	pipe.Expire(ctx, fmt.Sprintf("{session:%s}:task:%s:updates", sessionID, taskKey), ttl)
	_, err := pipe.Exec(ctx)
	return err
}
