package ws

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"
)

type mockBroadcaster struct {
	mu        sync.Mutex
	published [][]byte
}

func (m *mockBroadcaster) Publish(_ context.Context, _ string, data []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.published = append(m.published, append([]byte(nil), data...))
	return nil
}

func (m *mockBroadcaster) Subscribe(_ context.Context, _ string, _ func(data []byte)) (func(), error) {
	return func() {}, nil
}

func (m *mockBroadcaster) SubscribeRevocations(_ context.Context, _ func(userID, sessionID string)) (func(), error) {
	return func() {}, nil
}

func (m *mockBroadcaster) RevokeUser(_ context.Context, _ string) error {
	return nil
}

func (m *mockBroadcaster) InstanceID() string {
	return "test-instance"
}

type mockSessionStoreOrder struct {
	mu           sync.Mutex
	savedCodes   [][]byte
	savedPayload []CodeUpdatePayload
}

func (m *mockSessionStoreOrder) IsTokenRevoked(context.Context, string) (bool, error) {
	return false, nil
}
func (m *mockSessionStoreOrder) IsSessionActive(context.Context, string) (bool, error) {
	return true, nil
}
func (m *mockSessionStoreOrder) GetSessionUserRole(context.Context, string, string) (string, error) {
	return "candidate", nil
}
func (m *mockSessionStoreOrder) IsAuthSessionActive(context.Context, string) (bool, error) {
	return true, nil
}
func (m *mockSessionStoreOrder) ConsumeTicket(context.Context, string) (bool, error) {
	return true, nil
}
func (m *mockSessionStoreOrder) TouchMirror(context.Context, string, time.Duration) error {
	return nil
}
func (m *mockSessionStoreOrder) Ping(context.Context) error { return nil }
func (m *mockSessionStoreOrder) Close() error               { return nil }

func (m *mockSessionStoreOrder) SaveCodeState(_ context.Context, _ string, data []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.savedCodes = append(m.savedCodes, append([]byte(nil), data...))
	var p CodeUpdatePayload
	if err := json.Unmarshal(data, &p); err == nil {
		m.savedPayload = append(m.savedPayload, p)
	}
	return nil
}

func (m *mockSessionStoreOrder) GetCodeState(_ context.Context, _ string) ([]byte, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(m.savedCodes) == 0 {
		return nil, nil
	}
	return m.savedCodes[len(m.savedCodes)-1], nil
}

func TestRoom_OrderedPublishing(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	bcast := &mockBroadcaster{}
	room := NewRoom("test-session", bcast, nil, logger, nil)
	go room.Run(ctx)
	defer room.Close()

	// Отправляем серию сообщений
	for i := 1; i <= 20; i++ {
		chatEnv := NewEnvelope(
			EventChatMessage,
			"test-session",
			"",
			ChatMessagePayload{
				MessageID: "msg",
				Text:      string(rune('A' + i)),
				SentAt:    time.Now().UTC(),
			},
		)
		bytes, err := chatEnv.ToBytes()
		if err != nil {
			t.Fatalf("failed to serialize: %v", err)
		}
		room.Broadcast(bytes, "")
	}

	// Ждем пока publishWorker обработает очередь
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		bcast.mu.Lock()
		count := len(bcast.published)
		bcast.mu.Unlock()
		if count >= 20 {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}

	bcast.mu.Lock()
	defer bcast.mu.Unlock()

	if len(bcast.published) != 20 {
		t.Fatalf("expected 20 published messages, got %d", len(bcast.published))
	}

	// Проверяем строгий порядок (FIFO)
	for i, raw := range bcast.published {
		expectedChar := string(rune('A' + i + 1))
		rawEnv, err := ParseRawEnvelope(raw)
		if err != nil {
			t.Fatalf("failed to parse envelope %d: %v", i, err)
		}
		payload, err := UnpackPayload[ChatMessagePayload](rawEnv)
		if err != nil {
			t.Fatalf("failed to unpack payload %d: %v", i, err)
		}
		if payload.Text != expectedChar {
			t.Errorf("message %d text mismatch: expected %q, got %q", i, expectedChar, payload.Text)
		}
	}
}

func TestRoom_OrderedAndConditionalCodeSaving(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	store := &mockSessionStoreOrder{}
	room := NewRoom("test-session", nil, store, logger, nil)
	go room.Run(ctx)
	defer room.Close()

	// 1. Отправляем версии 1, 2, 3 по порядку
	for v := int64(1); v <= 3; v++ {
		codeEnv := NewEnvelope(
			EventCodeUpdate,
			"test-session",
			"",
			CodeUpdatePayload{
				FilePath: "main.ts",
				Content:  "content v",
				Version:  v,
			},
		)
		bytes, _ := codeEnv.ToBytes()
		room.Broadcast(bytes, "")
	}

	time.Sleep(50 * time.Millisecond)

	// 2. Отправляем устаревшую версию (Version: 2) — должна быть проигнорирована
	outdatedEnv := NewEnvelope(
		EventCodeUpdate,
		"test-session",
		"",
		CodeUpdatePayload{
			FilePath: "main.ts",
			Content:  "outdated v2",
			Version:  2,
		},
	)
	bytes, _ := outdatedEnv.ToBytes()
	room.Broadcast(bytes, "")

	// 3. Отправляем более новую версию (Version: 4) — должна быть сохранена
	newEnv := NewEnvelope(
		EventCodeUpdate,
		"test-session",
		"",
		CodeUpdatePayload{
			FilePath: "main.ts",
			Content:  "content v4",
			Version:  4,
		},
	)
	bytes, _ = newEnv.ToBytes()
	room.Broadcast(bytes, "")

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		store.mu.Lock()
		count := len(store.savedPayload)
		store.mu.Unlock()
		if count >= 4 {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	// Должны быть сохранены версии 1, 2, 3, 4 (outdated version 2 пропущена)
	if len(store.savedPayload) != 4 {
		t.Fatalf("expected 4 saved code states, got %d", len(store.savedPayload))
	}

	expectedVersions := []int64{1, 2, 3, 4}
	for i, p := range store.savedPayload {
		if p.Version != expectedVersions[i] {
			t.Errorf("saved payload %d: expected version %d, got %d", i, expectedVersions[i], p.Version)
		}
	}

	// Проверяем последнее состояние в памяти комнаты
	room.mu.RLock()
	lastState := room.lastCodeState
	room.mu.RUnlock()

	if lastState == nil || lastState.Version != 4 {
		t.Errorf("expected in-memory lastCodeState version 4, got %v", lastState)
	}
}
