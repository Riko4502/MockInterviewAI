package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/mockinterviewai/realtime/internal/config"
	"github.com/redis/go-redis/v9"
)

// Broadcaster интерфейс для распределенной рассылки событий между репликами сервиса.
type Broadcaster interface {
	Publish(ctx context.Context, sessionID string, data []byte) error
	Subscribe(ctx context.Context, sessionID string, onMessage func(data []byte)) (func(), error)
	InstanceID() string
}

// SessionStore интерфейс для проверки состояния токенов, сессий и ролей участников в Redis.
type SessionStore interface {
	IsTokenRevoked(ctx context.Context, tokenID string) (bool, error)
	IsSessionActive(ctx context.Context, sessionID string) (bool, error)
	GetSessionUserRole(ctx context.Context, sessionID, userID string) (string, error)
	Ping(ctx context.Context) error
	Close() error
}

// PubSubMessage обертка над сообщением для предотвращения эхо-повторов на одном и том же сервере.
type PubSubMessage struct {
	InstanceID string `json:"instanceId"`
	Data       []byte `json:"data"`
}

// RedisStore объединяет SessionStore и Broadcaster на базе Redis.
type RedisStore struct {
	client     *redis.Client
	instanceID string
	logger     *slog.Logger
	enabled    bool
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

	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		logger.Warn("failed to ping redis on startup, proceeding in soft-fail mode",
			slog.String("addr", cfg.RedisAddr),
			slog.String("error", err.Error()),
		)
	} else {
		logger.Info("connected to redis successfully",
			slog.String("addr", cfg.RedisAddr),
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

// InstanceID возвращает уникальный ID текущего инстанса сервиса.
func (r *RedisStore) InstanceID() string {
	return r.instanceID
}

// Publish публикует событие в канал Redis для всех реплик.
func (r *RedisStore) Publish(ctx context.Context, sessionID string, data []byte) error {
	if !r.enabled || r.client == nil {
		return nil
	}

	payload, err := json.Marshal(PubSubMessage{
		InstanceID: r.instanceID,
		Data:       data,
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
		defer pubsub.Close()
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
func (r *RedisStore) IsSessionActive(ctx context.Context, sessionID string) (bool, error) {
	if !r.enabled || r.client == nil || sessionID == "" {
		return true, nil
	}

	key := fmt.Sprintf("session:%s:active", sessionID)
	val, err := r.client.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return true, nil
		}
		r.logger.Warn("failed to check session active in redis", slog.String("error", err.Error()))
		return true, nil
	}

	return val != "false" && val != "closed", nil
}

// GetSessionUserRole получает проверенную роль пользователя в сессии из Redis (Hash: key "session:<id>:members").
func (r *RedisStore) GetSessionUserRole(ctx context.Context, sessionID, userID string) (string, error) {
	if !r.enabled || r.client == nil || sessionID == "" || userID == "" {
		return "", nil
	}

	key := fmt.Sprintf("session:%s:members", sessionID)
	role, err := r.client.HGet(ctx, key, userID).Result()
	if err != nil {
		if err == redis.Nil {
			return "", nil
		}
		r.logger.Warn("failed to fetch user role from redis session members",
			slog.String("sessionId", sessionID),
			slog.String("userId", userID),
			slog.String("error", err.Error()),
		)
		return "", nil
	}

	return role, nil
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
