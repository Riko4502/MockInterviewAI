package storage

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	redis "github.com/redis/go-redis/v9"
)

const (
	// notificationStreamMaxLen — приближенное ограничение глубины персонального
	// стрима уведомлений (XADD ... MAXLEN ~ 100). Стрим является буфером
	// оперативной доставки, полная история хранится в PostgreSQL сервисом apps/api.
	notificationStreamMaxLen = 100

	// notificationStreamTTL — срок жизни ключа стрима. Продлевается при каждой
	// публикации, поэтому стримы неактивных пользователей выгружаются из памяти Redis.
	notificationStreamTTL = 7 * 24 * time.Hour

	// sseConnectionCountTTL — TTL счетчика активных SSE-соединений пользователя.
	// Защищает от зависшего счетчика, если нода упала, не успев выполнить DECR.
	sseConnectionCountTTL = time.Hour

	// broadcastChannel — Redis Pub/Sub канал общесистемных оповещений.
	broadcastChannel = "notifications:broadcast"
)

// StreamEvent — событие, прочитанное из персонального Redis Stream пользователя.
type StreamEvent struct {
	// ID — Redis Stream ID вида "<ms>-<seq>", он же Last-Event-ID для клиента.
	ID string
	// Type — тип события SSE (например, "notification.new").
	Type string
	// Timestamp — время генерации события продюсером в формате RFC 3339.
	Timestamp string
	// Payload — тело события в исходном JSON-представлении.
	Payload []byte
}

// BroadcastMessage — формат сообщения в канале Pub/Sub "notifications:broadcast".
//
// В отличие от событий комнат, бродкасты публикуются внешними продюсерами
// (apps/api, админ-панель), поэтому обертка PubSubMessage с instanceId здесь
// не применяется: сервис realtime только потребляет этот канал.
type BroadcastMessage struct {
	Type      string          `json:"type"`
	Timestamp string          `json:"timestamp,omitempty"`
	Payload   json.RawMessage `json:"payload"`
}

// NotificationStore описывает работу с персональными стримами уведомлений,
// каналом общесистемных бродкастов и счетчиками SSE-соединений в Redis.
type NotificationStore interface {
	// PublishNotification добавляет событие в стрим пользователя и возвращает присвоенный Stream ID.
	PublishNotification(ctx context.Context, userID, eventType string, payload []byte) (string, error)
	// ReadHistory возвращает события, появившиеся строго после afterID (фаза Replay).
	ReadHistory(ctx context.Context, userID, afterID string, count int64) ([]StreamEvent, error)
	// ReadStream блокирующе ожидает новые события после lastID (фаза Live Streaming).
	ReadStream(ctx context.Context, userID, lastID string, count int64, block time.Duration) ([]StreamEvent, error)
	// LastStreamID возвращает ID последнего события в стриме пользователя ("0-0", если стрим пуст).
	LastStreamID(ctx context.Context, userID string) (string, error)
	// PublishBroadcast публикует общесистемное оповещение всем подключенным клиентам кластера.
	PublishBroadcast(ctx context.Context, eventType string, payload []byte) error
	// SubscribeBroadcast подписывается на канал общесистемных оповещений.
	SubscribeBroadcast(ctx context.Context, onMessage func(msg BroadcastMessage)) (func(), error)
	// IncrUserConnections атомарно увеличивает счетчик SSE-соединений пользователя по кластеру.
	IncrUserConnections(ctx context.Context, userID string) (int64, error)
	// DecrUserConnections уменьшает счетчик SSE-соединений пользователя.
	DecrUserConnections(ctx context.Context, userID string) error
	// Enabled сообщает, доступен ли слой Redis (иначе сервис работает как одиночная нода).
	Enabled() bool
}

// notificationStreamKey возвращает ключ персонального стрима уведомлений пользователя.
func notificationStreamKey(userID string) string {
	return fmt.Sprintf("user:%s:notifications", userID)
}

// sseConnectionCountKey возвращает ключ счетчика активных SSE-соединений пользователя.
func sseConnectionCountKey(userID string) string {
	return fmt.Sprintf("user:%s:sse_count", userID)
}

// Enabled сообщает, инициализирован ли клиент Redis.
func (r *RedisStore) Enabled() bool {
	return r.enabled && r.client != nil
}

// PublishNotification публикует событие в персональный стрим пользователя
// (XADD с MAXLEN ~ 100) и продлевает TTL ключа стрима.
func (r *RedisStore) PublishNotification(ctx context.Context, userID, eventType string, payload []byte) (string, error) {
	if !r.Enabled() {
		return "", nil
	}

	if userID == "" || eventType == "" {
		return "", errors.New("userId and eventType are required to publish a notification")
	}

	if len(payload) == 0 {
		payload = []byte("{}")
	}

	key := notificationStreamKey(userID)

	id, err := r.client.XAdd(ctx, &redis.XAddArgs{
		Stream: key,
		MaxLen: notificationStreamMaxLen,
		Approx: true,
		Values: map[string]any{
			"type":      eventType,
			"payload":   string(payload),
			"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
		},
	}).Result()
	if err != nil {
		return "", fmt.Errorf("failed to XADD notification for user %s: %w", userID, err)
	}

	if expireErr := r.client.Expire(ctx, key, notificationStreamTTL).Err(); expireErr != nil {
		r.logger.Warn("failed to refresh notification stream ttl",
			slog.String("userId", userID),
			slog.String("error", expireErr.Error()),
		)
	}

	return id, nil
}

// ReadHistory возвращает пропущенные пользователем события строго после afterID.
// Используется в фазе Replay при переподключении с заголовком Last-Event-ID.
func (r *RedisStore) ReadHistory(ctx context.Context, userID, afterID string, count int64) ([]StreamEvent, error) {
	if !r.Enabled() || userID == "" {
		return nil, nil
	}

	if count <= 0 {
		count = 20
	}

	// Эксклюзивный интервал "(<id>" исключает уже доставленное клиенту событие.
	messages, err := r.client.XRangeN(ctx, notificationStreamKey(userID), "("+afterID, "+", count).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to XRANGE notifications for user %s: %w", userID, err)
	}

	return convertMessages(messages), nil
}

// ReadStream блокирующе читает новые события стрима пользователя (XREAD BLOCK).
// Значение lastID "$" означает только события, появившиеся после подписки.
func (r *RedisStore) ReadStream(
	ctx context.Context,
	userID, lastID string,
	count int64,
	block time.Duration,
) ([]StreamEvent, error) {
	if !r.Enabled() || userID == "" {
		// Без Redis новых событий появиться не может: выдерживаем паузу,
		// чтобы вызывающая горутина не крутила пустой цикл на 100% CPU.
		return nil, sleepCtx(ctx, block)
	}

	if lastID == "" {
		lastID = "$"
	}

	if count <= 0 {
		count = 20
	}

	streams, err := r.client.XRead(ctx, &redis.XReadArgs{
		Streams: []string{notificationStreamKey(userID), lastID},
		Count:   count,
		Block:   block,
	}).Result()
	if err != nil {
		// redis.Nil возвращается по истечении BLOCK без новых событий — это норма.
		if errors.Is(err, redis.Nil) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to XREAD notifications for user %s: %w", userID, err)
	}

	events := make([]StreamEvent, 0, count)
	for i := range streams {
		events = append(events, convertMessages(streams[i].Messages)...)
	}

	return events, nil
}

// LastStreamID возвращает ID последнего события в стриме пользователя.
// Значение "0-0" означает, что стрим пуст или еще не создан.
func (r *RedisStore) LastStreamID(ctx context.Context, userID string) (string, error) {
	if !r.Enabled() || userID == "" {
		return "0-0", nil
	}

	messages, err := r.client.XRevRangeN(ctx, notificationStreamKey(userID), "+", "-", 1).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return "0-0", nil
		}
		return "0-0", fmt.Errorf("failed to read last stream id for user %s: %w", userID, err)
	}

	if len(messages) == 0 {
		return "0-0", nil
	}

	return messages[0].ID, nil
}

// PublishBroadcast публикует общесистемное оповещение в канал "notifications:broadcast".
func (r *RedisStore) PublishBroadcast(ctx context.Context, eventType string, payload []byte) error {
	if !r.Enabled() {
		return nil
	}

	if len(payload) == 0 {
		payload = []byte("{}")
	}

	body, err := json.Marshal(BroadcastMessage{
		Type:      eventType,
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
		Payload:   payload,
	})
	if err != nil {
		return fmt.Errorf("failed to marshal broadcast message: %w", err)
	}

	return r.client.Publish(ctx, broadcastChannel, body).Err()
}

// SubscribeBroadcast подписывается на канал общесистемных оповещений и передает
// каждое валидное сообщение в обработчик. Возвращает функцию отписки.
func (r *RedisStore) SubscribeBroadcast(ctx context.Context, onMessage func(msg BroadcastMessage)) (func(), error) {
	if !r.Enabled() {
		return func() {}, nil
	}

	pubsub := r.client.Subscribe(ctx, broadcastChannel)
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

				var broadcast BroadcastMessage
				if err := json.Unmarshal([]byte(msg.Payload), &broadcast); err != nil {
					r.logger.Warn("received malformed system broadcast payload",
						slog.String("error", err.Error()),
					)
					continue
				}

				if broadcast.Type == "" {
					continue
				}

				onMessage(broadcast)
			}
		}
	}()

	unsubscribe := func() {
		cancel()
		_ = pubsub.Close()
	}

	return unsubscribe, nil
}

// IncrUserConnections увеличивает счетчик активных SSE-соединений пользователя
// по всему кластеру и возвращает новое значение. При выключенном Redis
// возвращает 0 — ограничение в этом случае проверяется локально на ноде.
func (r *RedisStore) IncrUserConnections(ctx context.Context, userID string) (int64, error) {
	if !r.Enabled() || userID == "" {
		return 0, nil
	}

	key := sseConnectionCountKey(userID)

	pipe := r.client.TxPipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, sseConnectionCountTTL)

	if _, err := pipe.Exec(ctx); err != nil {
		return 0, fmt.Errorf("failed to increment sse connection counter for user %s: %w", userID, err)
	}

	return incr.Val(), nil
}

// DecrUserConnections уменьшает счетчик активных SSE-соединений пользователя
// и удаляет ключ, когда соединений не осталось.
func (r *RedisStore) DecrUserConnections(ctx context.Context, userID string) error {
	if !r.Enabled() || userID == "" {
		return nil
	}

	key := sseConnectionCountKey(userID)

	remaining, err := r.client.Decr(ctx, key).Result()
	if err != nil {
		return fmt.Errorf("failed to decrement sse connection counter for user %s: %w", userID, err)
	}

	if remaining <= 0 {
		if delErr := r.client.Del(ctx, key).Err(); delErr != nil {
			r.logger.Warn("failed to delete drained sse connection counter",
				slog.String("userId", userID),
				slog.String("error", delErr.Error()),
			)
		}
	}

	return nil
}

// convertMessages преобразует сообщения Redis Stream во внутреннее представление.
func convertMessages(messages []redis.XMessage) []StreamEvent {
	events := make([]StreamEvent, 0, len(messages))

	for i := range messages {
		event := StreamEvent{ID: messages[i].ID}

		if raw, ok := messages[i].Values["type"].(string); ok {
			event.Type = raw
		}

		if raw, ok := messages[i].Values["timestamp"].(string); ok {
			event.Timestamp = raw
		}

		if raw, ok := messages[i].Values["payload"].(string); ok {
			event.Payload = []byte(raw)
		}

		if event.Type == "" {
			// Событие без типа невозможно превратить в корректный SSE-кадр.
			continue
		}

		events = append(events, event)
	}

	return events
}

// sleepCtx выдерживает паузу, прерываясь при отмене контекста.
func sleepCtx(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return ctx.Err()
	}

	timer := time.NewTimer(d)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}
