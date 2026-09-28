package storage

import (
	"context"
	"io"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/mockinterviewai/realtime/internal/config"
	redis "github.com/redis/go-redis/v9"
)

// TestConvertMessages проверяет разбор записи стрима, которую пишет
// apps/api после появления поля timestamp (контракт notification.new).
func TestConvertMessages(t *testing.T) {
	cases := []struct {
		name     string
		messages []redis.XMessage
		want     []StreamEvent
	}{
		{
			name: "новый формат apps/api: type, payload, timestamp",
			messages: []redis.XMessage{
				{
					ID: "1790599044891-0",
					Values: map[string]any{
						"type":      "notification.new",
						"payload":   `{"id":"n1","createdAt":"2026-09-28T10:00:00.000Z","read":false}`,
						"timestamp": "2026-09-28T10:00:00.000Z",
					},
				},
			},
			want: []StreamEvent{
				{
					ID:        "1790599044891-0",
					Type:      "notification.new",
					Timestamp: "2026-09-28T10:00:00.000Z",
					Payload:   []byte(`{"id":"n1","createdAt":"2026-09-28T10:00:00.000Z","read":false}`),
				},
			},
		},
		{
			name: "старый формат без timestamp: время отдаётся пустым, не выдумывается",
			messages: []redis.XMessage{
				{
					ID: "1790599044892-0",
					Values: map[string]any{
						"type":    "notification.new",
						"payload": `{"id":"n2"}`,
					},
				},
			},
			want: []StreamEvent{
				{
					ID:      "1790599044892-0",
					Type:    "notification.new",
					Payload: []byte(`{"id":"n2"}`),
				},
			},
		},
		{
			name: "событие без type отбрасывается",
			messages: []redis.XMessage{
				{ID: "1-0", Values: map[string]any{"payload": `{}`}},
				{ID: "2-0", Values: map[string]any{"type": "notification.badge", "payload": `{"unreadCount":1}`}},
			},
			want: []StreamEvent{
				{ID: "2-0", Type: "notification.badge", Payload: []byte(`{"unreadCount":1}`)},
			},
		},
		{
			name:     "пустой вход",
			messages: []redis.XMessage{},
			want:     []StreamEvent{},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := convertMessages(tc.messages)

			if len(got) != len(tc.want) {
				t.Fatalf("convertMessages() вернул %d событий, ожидалось %d", len(got), len(tc.want))
			}

			for i := range tc.want {
				if got[i].ID != tc.want[i].ID {
					t.Errorf("событие %d: ID = %q, ожидалось %q", i, got[i].ID, tc.want[i].ID)
				}
				if got[i].Type != tc.want[i].Type {
					t.Errorf("событие %d: Type = %q, ожидалось %q", i, got[i].Type, tc.want[i].Type)
				}
				if got[i].Timestamp != tc.want[i].Timestamp {
					t.Errorf("событие %d: Timestamp = %q, ожидалось %q", i, got[i].Timestamp, tc.want[i].Timestamp)
				}
				if string(got[i].Payload) != string(tc.want[i].Payload) {
					t.Errorf("событие %d: Payload = %q, ожидалось %q", i, got[i].Payload, tc.want[i].Payload)
				}
			}
		})
	}
}

// newIntegrationStore поднимает RedisStore на реальном Redis.
// Тест пропускается, если REDIS_PASSWORD/REDIS_HOST не заданы или Redis недоступен.
func newIntegrationStore(t *testing.T) *RedisStore {
	t.Helper()

	host, port, password := os.Getenv("REDIS_HOST"), os.Getenv("REDIS_PORT"), os.Getenv("REDIS_PASSWORD")
	if host == "" {
		host = "localhost"
	}
	if port == "" {
		port = "6379"
	}
	if password == "" {
		t.Skip("REDIS_PASSWORD не задан — интеграционный тест с реальным Redis пропущен")
	}

	cfg := &config.Config{
		RedisEnabled:  true,
		RedisAddr:     host + ":" + port,
		RedisPassword: password,
	}

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	store := NewRedisStore(cfg, logger)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := store.client.Ping(ctx).Err(); err != nil {
		_ = store.Close()
		t.Skipf("Redis недоступен по %s: %v", cfg.RedisAddr, err)
	}

	t.Cleanup(func() { _ = store.Close() })

	return store
}

// TestReadHistoryReadsApiStreamFormat — сквозная проверка контракта:
// запись, записанная в формате apps/api, читается realtime без потерь,
// включая новое поле timestamp.
func TestReadHistoryReadsApiStreamFormat(t *testing.T) {
	store := newIntegrationStore(t)

	ctx := context.Background()
	userID := "go-contract-check"
	key := notificationStreamKey(userID)
	streamKey := "user:" + userID + ":notifications"

	if err := store.client.Del(ctx, streamKey).Err(); err != nil {
		t.Fatalf("не удалось очистить стрим %s: %v", streamKey, err)
	}
	t.Cleanup(func() { _ = store.client.Del(context.Background(), streamKey) })

	if key != streamKey {
		t.Fatalf("несогласованный ключ стрима: %q != %q", key, streamKey)
	}

	payload := `{"id":"11111111-1111-4111-a111-111111111111","title":"Приглашение","message":"Новое интервью","category":"INTERVIEW","actionUrl":null,"createdAt":"2026-09-28T10:00:00.000Z","read":false}`
	const wantTimestamp = "2026-09-28T10:00:00.000Z"

	// Пишем ровно те поля и в том порядке, что даёт RedisService.xadd из apps/api.
	id, err := store.client.XAdd(ctx, &redis.XAddArgs{
		Stream: streamKey,
		MaxLen: 100,
		Approx: true,
		Values: map[string]any{
			"type":      "notification.new",
			"payload":   payload,
			"timestamp": wantTimestamp,
		},
	}).Result()
	if err != nil {
		t.Fatalf("XAdd не выполнился: %v", err)
	}

	// Запись без timestamp — реплей старых событий, уже лежащих в стриме.
	if _, err := store.client.XAdd(ctx, &redis.XAddArgs{
		Stream: streamKey,
		MaxLen: 100,
		Approx: true,
		Values: map[string]any{
			"type":    "notification.badge",
			"payload": `{"unreadCount":3}`,
		},
	}).Result(); err != nil {
		t.Fatalf("XAdd (legacy) не выполнился: %v", err)
	}

	events, err := store.ReadHistory(ctx, userID, "0-0", 10)
	if err != nil {
		t.Fatalf("ReadHistory вернул ошибку: %v", err)
	}

	if len(events) != 2 {
		t.Fatalf("ReadHistory вернул %d событий, ожидалось 2", len(events))
	}

	first := events[0]
	if first.ID != id {
		t.Errorf("ID первого события = %q, ожидался %q", first.ID, id)
	}
	if first.Type != "notification.new" {
		t.Errorf("Type = %q, ожидалось %q", first.Type, "notification.new")
	}
	if first.Timestamp != wantTimestamp {
		t.Errorf("Timestamp = %q, ожидалось %q", first.Timestamp, wantTimestamp)
	}
	if string(first.Payload) != payload {
		t.Errorf("Payload = %q, ожидалось %q", first.Payload, payload)
	}

	if second := events[1]; second.Timestamp != "" {
		t.Errorf("у записи без timestamp поле Timestamp = %q, ожидалась пустая строка", second.Timestamp)
	}
}
