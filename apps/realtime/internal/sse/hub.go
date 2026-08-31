package sse

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/mockinterviewai/realtime/internal/storage"
)

const (
	// defaultClientBufferSize — емкость кольцевого буфера одного соединения.
	defaultClientBufferSize = 128

	// defaultHeartbeatInterval — период отправки комментария ": ping <ts>".
	defaultHeartbeatInterval = 15 * time.Second

	// defaultStreamBlockInterval — длительность блокирующего XREAD BLOCK.
	defaultStreamBlockInterval = 15 * time.Second

	// defaultReplayCount — максимум событий, отдаваемых в фазе Replay.
	defaultReplayCount = 20

	// defaultRetryMs — рекомендуемый клиенту интервал переподключения (поле retry).
	defaultRetryMs = 3000

	// defaultSlowConsumerGrace — сколько времени буфер клиента может оставаться
	// переполненным до принудительного разрыва соединения.
	defaultSlowConsumerGrace = 30 * time.Second

	// readerErrorBackoff — стартовая пауза перед повтором чтения стрима после ошибки Redis.
	readerErrorBackoff = 500 * time.Millisecond

	// readerErrorBackoffMax — верхняя граница экспоненциальной паузы.
	readerErrorBackoffMax = 15 * time.Second
)

var (
	// ErrUserConnectionLimit возвращается при превышении лимита SSE-соединений пользователя.
	ErrUserConnectionLimit = errors.New("sse connection limit per user exceeded")

	// ErrIPConnectionLimit возвращается при превышении лимита SSE-соединений с одного IP.
	ErrIPConnectionLimit = errors.New("sse connection limit per ip exceeded")

	// ErrHubClosed возвращается при попытке подключения к остановленному хабу.
	ErrHubClosed = errors.New("sse hub is shutting down")
)

// Options задает параметры работы SSE-подсистемы.
type Options struct {
	// HeartbeatInterval — период отправки heartbeat-комментариев.
	HeartbeatInterval time.Duration
	// ClientBufferSize — емкость кольцевого буфера одного соединения.
	ClientBufferSize int
	// MaxConnectionsPerUser — максимум одновременных вкладок одного пользователя.
	MaxConnectionsPerUser int
	// MaxConnectionsPerIP — максимум одновременных соединений с одного IP-адреса.
	MaxConnectionsPerIP int
	// ReplayCount — максимум событий, отдаваемых при восстановлении по Last-Event-ID.
	ReplayCount int64
	// StreamBlockInterval — длительность блокирующего чтения XREAD BLOCK.
	StreamBlockInterval time.Duration
	// SlowConsumerGrace — допустимое время переполнения буфера клиента.
	SlowConsumerGrace time.Duration
	// RetryMs — значение поля retry в SSE-кадрах.
	RetryMs int
}

// withDefaults подставляет значения по умолчанию вместо неуказанных параметров.
func (o Options) withDefaults() Options {
	if o.HeartbeatInterval <= 0 {
		o.HeartbeatInterval = defaultHeartbeatInterval
	}

	if o.ClientBufferSize <= 0 {
		o.ClientBufferSize = defaultClientBufferSize
	}

	if o.MaxConnectionsPerUser <= 0 {
		o.MaxConnectionsPerUser = 5
	}

	if o.MaxConnectionsPerIP <= 0 {
		o.MaxConnectionsPerIP = 20
	}

	if o.ReplayCount <= 0 {
		o.ReplayCount = defaultReplayCount
	}

	if o.StreamBlockInterval <= 0 {
		o.StreamBlockInterval = defaultStreamBlockInterval
	}

	if o.SlowConsumerGrace <= 0 {
		o.SlowConsumerGrace = defaultSlowConsumerGrace
	}

	if o.RetryMs <= 0 {
		o.RetryMs = defaultRetryMs
	}

	return o
}

// RevocationSubscriber описывает источник сигналов мгновенного отзыва авторизации.
type RevocationSubscriber interface {
	SubscribeRevocations(ctx context.Context, onRevoke func(userID string)) (func(), error)
}

// userSession объединяет все активные вкладки одного пользователя на данной ноде.
// На сессию приходится ровно одна горутина вычитки персонального Redis Stream.
type userSession struct {
	userID  string
	clients map[string]*Client
	mu      sync.RWMutex
	cancel  context.CancelFunc
}

// dispatch мультиплексирует событие во все локальные вкладки пользователя.
func (s *userSession) dispatch(env *Envelope, metrics *Metrics) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, client := range s.clients {
		if client.Send(env) {
			metrics.IncDispatched(env.Type.String())
		}
	}
}

// Hub — реестр SSE-сессий пользователей на текущей ноде.
type Hub struct {
	store   storage.NotificationStore
	opts    Options
	metrics *Metrics
	logger  *slog.Logger

	mu       sync.RWMutex
	sessions map[string]*userSession
	ipCounts map[string]int
	closed   bool

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// NewHub создает хаб SSE-соединений, подписывается на канал общесистемных
// оповещений и на сигналы отзыва авторизации пользователей.
func NewHub(
	parentCtx context.Context,
	store storage.NotificationStore,
	revocations RevocationSubscriber,
	opts Options,
	nodeID string,
	logger *slog.Logger,
) *Hub {
	ctx, cancel := context.WithCancel(parentCtx)

	hub := &Hub{
		store:    store,
		opts:     opts.withDefaults(),
		metrics:  NewMetrics(nodeID),
		logger:   logger.With(slog.String("component", "sse_hub")),
		sessions: make(map[string]*userSession),
		ipCounts: make(map[string]int),
		ctx:      ctx,
		cancel:   cancel,
	}

	hub.subscribeBroadcast(ctx)
	hub.subscribeRevocations(ctx, revocations)

	return hub
}

// Metrics возвращает набор метрик SSE-подсистемы.
func (h *Hub) Metrics() *Metrics {
	return h.metrics
}

// Options возвращает применяемые параметры SSE-подсистемы.
func (h *Hub) Options() Options {
	return h.opts
}

// subscribeBroadcast подписывает ноду на канал "notifications:broadcast".
func (h *Hub) subscribeBroadcast(ctx context.Context) {
	if h.store == nil {
		return
	}

	unsubscribe, err := h.store.SubscribeBroadcast(ctx, func(msg storage.BroadcastMessage) {
		h.BroadcastAll(&Envelope{
			// Бродкасты не хранятся в персональных стримах, поэтому кадр
			// отправляется без поля id и не сбивает курсор Last-Event-ID.
			Type:      EventType(msg.Type),
			Timestamp: parseTimestamp(msg.Timestamp, ""),
			Payload:   normalizePayload(msg.Payload),
		})
	})
	if err != nil {
		h.logger.Warn("failed to subscribe to system broadcast channel",
			slog.String("error", err.Error()),
		)
		return
	}

	if unsubscribe != nil {
		go func() {
			<-ctx.Done()
			unsubscribe()
		}()
	}
}

// subscribeRevocations подписывает ноду на канал "auth:revocations".
func (h *Hub) subscribeRevocations(ctx context.Context, revocations RevocationSubscriber) {
	if revocations == nil {
		return
	}

	unsubscribe, err := revocations.SubscribeRevocations(ctx, func(userID string) {
		h.EvictUser(userID, "user authentication revoked")
	})
	if err != nil {
		h.logger.Warn("failed to subscribe to auth revocations channel",
			slog.String("error", err.Error()),
		)
		return
	}

	if unsubscribe != nil {
		go func() {
			<-ctx.Done()
			unsubscribe()
		}()
	}
}

// Register регистрирует новое соединение, проверяя лимиты на пользователя и на IP.
// Клиент попадает в реестр до начала фазы Replay, поэтому события, пришедшие во
// время восстановления истории, накапливаются в его буфере и не теряются.
func (h *Hub) Register(ctx context.Context, client *Client) error {
	h.mu.Lock()

	if h.closed {
		h.mu.Unlock()
		return ErrHubClosed
	}

	if client.IP != "" && h.ipCounts[client.IP] >= h.opts.MaxConnectionsPerIP {
		h.mu.Unlock()
		return ErrIPConnectionLimit
	}

	session, exists := h.sessions[client.UserID]
	if exists {
		session.mu.RLock()
		reached := len(session.clients) >= h.opts.MaxConnectionsPerUser
		session.mu.RUnlock()

		if reached {
			h.mu.Unlock()
			return ErrUserConnectionLimit
		}
	} else {
		sessionCtx, sessionCancel := context.WithCancel(h.ctx)
		session = &userSession{
			userID:  client.UserID,
			clients: make(map[string]*Client),
			cancel:  sessionCancel,
		}
		h.sessions[client.UserID] = session

		h.wg.Add(1)
		go func() {
			defer h.wg.Done()
			h.runUserReader(sessionCtx, session)
		}()
	}

	session.mu.Lock()
	session.clients[client.ID] = client
	session.mu.Unlock()

	if client.IP != "" {
		h.ipCounts[client.IP]++
	}

	activeUsers := len(h.sessions)
	h.mu.Unlock()

	// Кластерный лимит: локального счетчика недостаточно, когда вкладки одного
	// пользователя распределены балансировщиком по разным нодам.
	if h.store != nil {
		count, err := h.store.IncrUserConnections(ctx, client.UserID)
		switch {
		case err != nil:
			// Soft-fail: недоступность счетчика не должна ронять уведомления.
			h.logger.Warn("failed to reserve cluster-wide sse connection slot",
				slog.String("userId", client.UserID),
				slog.String("error", err.Error()),
			)
		case count > int64(h.opts.MaxConnectionsPerUser):
			client.redisReserved = true
			h.Unregister(client)
			return ErrUserConnectionLimit
		default:
			client.redisReserved = true
		}
	}

	h.metrics.IncConnectedClients()
	h.metrics.SetActiveUsers(activeUsers)
	h.metrics.IncConnections(ConnStatusSuccess)

	h.logger.Info("sse client registered",
		slog.String("sseClientId", client.ID),
		slog.String("userId", client.UserID),
		slog.Int("activeUsers", activeUsers),
	)

	return nil
}

// Unregister удаляет соединение из реестра и, если это была последняя вкладка
// пользователя, останавливает горутину вычитки его стрима.
func (h *Hub) Unregister(client *Client) {
	h.mu.Lock()

	session, exists := h.sessions[client.UserID]
	if !exists {
		h.mu.Unlock()
		return
	}

	session.mu.Lock()
	if _, registered := session.clients[client.ID]; !registered {
		session.mu.Unlock()
		h.mu.Unlock()
		return
	}
	delete(session.clients, client.ID)
	remaining := len(session.clients)
	session.mu.Unlock()

	if client.IP != "" {
		if count := h.ipCounts[client.IP] - 1; count > 0 {
			h.ipCounts[client.IP] = count
		} else {
			delete(h.ipCounts, client.IP)
		}
	}

	if remaining == 0 {
		session.cancel()
		delete(h.sessions, client.UserID)
	}

	activeUsers := len(h.sessions)
	h.mu.Unlock()

	if client.redisReserved && h.store != nil {
		releaseCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		if err := h.store.DecrUserConnections(releaseCtx, client.UserID); err != nil {
			h.logger.Warn("failed to release cluster-wide sse connection slot",
				slog.String("userId", client.UserID),
				slog.String("error", err.Error()),
			)
		}
		cancel()
	}

	h.metrics.DecConnectedClients()
	h.metrics.SetActiveUsers(activeUsers)
	h.metrics.ObserveSessionDuration(time.Since(client.ConnectedAt).Seconds())

	h.logger.Info("sse client unregistered",
		slog.String("sseClientId", client.ID),
		slog.String("userId", client.UserID),
		slog.Int64("droppedMessages", client.Dropped()),
		slog.Int("remainingTabs", remaining),
	)
}

// runUserReader — единственная на пользователя горутина вычитки Redis Stream.
// Прочитанные события мультиплексируются во все вкладки этого пользователя.
func (h *Hub) runUserReader(ctx context.Context, session *userSession) {
	if h.store == nil {
		return
	}

	// "$" — читать только события, появившиеся после начала подписки.
	// Пропущенное за время оффлайна каждая вкладка добирает сама в фазе Replay.
	lastID := "$"
	backoff := readerErrorBackoff

	h.logger.Debug("started notification stream reader",
		slog.String("userId", session.userID),
	)

	defer h.logger.Debug("stopped notification stream reader",
		slog.String("userId", session.userID),
	)

	for {
		if ctx.Err() != nil {
			return
		}

		events, err := h.store.ReadStream(
			ctx,
			session.userID,
			lastID,
			h.opts.ReplayCount,
			h.opts.StreamBlockInterval,
		)
		if err != nil {
			if ctx.Err() != nil {
				return
			}

			h.logger.Warn("failed to read notification stream, retrying",
				slog.String("userId", session.userID),
				slog.Duration("backoff", backoff),
				slog.String("error", err.Error()),
			)

			select {
			case <-ctx.Done():
				return
			case <-time.After(backoff):
			}

			if backoff < readerErrorBackoffMax {
				backoff *= 2
			}

			continue
		}

		backoff = readerErrorBackoff

		for i := range events {
			lastID = events[i].ID
			h.metrics.ObserveStreamLag(streamLagSeconds(events[i].ID))
			session.dispatch(EnvelopeFromStreamEvent(events[i]), h.metrics)
		}
	}
}

// BroadcastAll доставляет событие всем подключенным к ноде клиентам.
func (h *Hub) BroadcastAll(env *Envelope) {
	h.mu.RLock()
	sessions := make([]*userSession, 0, len(h.sessions))
	for _, session := range h.sessions {
		sessions = append(sessions, session)
	}
	h.mu.RUnlock()

	for _, session := range sessions {
		session.dispatch(env, h.metrics)
	}
}

// EvictUser отправляет пользователю финальное событие auth.revoked и разрывает
// все его SSE-потоки на этой ноде.
func (h *Hub) EvictUser(userID, reason string) {
	h.mu.RLock()
	session, exists := h.sessions[userID]
	h.mu.RUnlock()

	if !exists {
		return
	}

	env, err := NewEnvelope("", EventAuthRevoked, AuthRevokedPayload{Reason: reason})
	if err != nil {
		h.logger.Warn("failed to build auth.revoked envelope",
			slog.String("error", err.Error()),
		)
	}

	session.mu.RLock()
	clients := make([]*Client, 0, len(session.clients))
	for _, client := range session.clients {
		clients = append(clients, client)
	}
	session.mu.RUnlock()

	for _, client := range clients {
		if env != nil && client.Send(env) {
			h.metrics.IncDispatched(EventAuthRevoked.String())
		}
		client.Close(reason)
	}

	h.logger.Warn("evicted sse client connections due to auth revocation",
		slog.String("userId", userID),
		slog.Int("connections", len(clients)),
		slog.String("reason", reason),
	)
}

// Stats возвращает текущее число активных соединений и уникальных пользователей на ноде.
func (h *Hub) Stats() (clients, users int) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, session := range h.sessions {
		session.mu.RLock()
		clients += len(session.clients)
		session.mu.RUnlock()
	}

	return clients, len(h.sessions)
}

// Close останавливает все SSE-потоки ноды и дожидается завершения горутин вычитки.
func (h *Hub) Close() error {
	h.mu.Lock()

	if h.closed {
		h.mu.Unlock()
		return nil
	}
	h.closed = true

	sessions := make([]*userSession, 0, len(h.sessions))
	for _, session := range h.sessions {
		sessions = append(sessions, session)
	}
	h.mu.Unlock()

	h.logger.Info("initiating sse hub shutdown", slog.Int("activeUsers", len(sessions)))

	for _, session := range sessions {
		session.mu.RLock()
		for _, client := range session.clients {
			client.Close("server shutting down")
		}
		session.mu.RUnlock()
	}

	h.cancel()
	h.wg.Wait()

	h.logger.Info("sse hub shutdown completed")

	return nil
}

// EnvelopeFromStreamEvent преобразует запись Redis Stream в конверт SSE.
func EnvelopeFromStreamEvent(event storage.StreamEvent) *Envelope {
	return &Envelope{
		ID:        event.ID,
		Type:      EventType(event.Type),
		Timestamp: parseTimestamp(event.Timestamp, event.ID),
		Payload:   normalizePayload(event.Payload),
	}
}

// normalizePayload гарантирует, что в кадр попадет валидный JSON: некорректное
// тело от продюсера иначе сломало бы парсер конверта на клиенте.
func normalizePayload(payload []byte) json.RawMessage {
	if len(payload) == 0 || !json.Valid(payload) {
		return json.RawMessage("null")
	}

	return json.RawMessage(payload)
}

// parseTimestamp восстанавливает время события: сначала из поля продюсера,
// затем из миллисекундной части Redis Stream ID, иначе — текущее время.
func parseTimestamp(raw, streamID string) time.Time {
	if raw != "" {
		if parsed, err := time.Parse(time.RFC3339Nano, raw); err == nil {
			return parsed.UTC()
		}
	}

	if ms, _ := splitStreamID(streamID); ms > 0 {
		return time.UnixMilli(ms).UTC()
	}

	return time.Now().UTC()
}

// streamLagSeconds вычисляет задержку доставки по временной метке Redis Stream ID.
func streamLagSeconds(streamID string) float64 {
	ms, _ := splitStreamID(streamID)
	if ms == 0 {
		return 0
	}

	lag := time.Since(time.UnixMilli(ms)).Seconds()
	if lag < 0 {
		return 0
	}

	return lag
}
