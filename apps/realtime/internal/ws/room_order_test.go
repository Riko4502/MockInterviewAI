package ws

import (
	"context"
	"encoding/json"
	"fmt"
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
	nextVersion  int64
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

func (m *mockSessionStoreOrder) NextCodeVersion(_ context.Context, _ string) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.nextVersion++
	return m.nextVersion, nil
}

func (m *mockSessionStoreOrder) SaveCodeState(_ context.Context, _ string, data []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	var p CodeUpdatePayload
	if err := json.Unmarshal(data, &p); err == nil {
		if len(m.savedPayload) > 0 && p.Version <= m.savedPayload[len(m.savedPayload)-1].Version {
			return nil
		}
		m.savedPayload = append(m.savedPayload, p)
	}
	m.savedCodes = append(m.savedCodes, append([]byte(nil), data...))
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

func TestRoom_ServerMonotonicVersionAssignment(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	store := &mockSessionStoreOrder{}
	room := NewRoom("test-session-monotonic", nil, store, logger, nil)
	go room.Run(ctx)
	defer room.Close()

	// Клиенты шлют обновления с произвольными версиями (например, version: 0 или рассинхронизированное локальное время)
	clientSentVersions := []int64{0, 100, 50, 50, 0}
	for i, v := range clientSentVersions {
		codeEnv := NewEnvelope(
			EventCodeUpdate,
			"test-session-monotonic",
			"",
			CodeUpdatePayload{
				FilePath: "main.ts",
				Content:  fmt.Sprintf("content step %d", i+1),
				Version:  v,
			},
		)
		bytes, _ := codeEnv.ToBytes()
		room.Broadcast(bytes, "")
	}

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		store.mu.Lock()
		count := len(store.savedPayload)
		store.mu.Unlock()
		if count >= len(clientSentVersions) {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	// Сервер должен назначить строго монотонные версии: 1, 2, 3, 4, 5
	if len(store.savedPayload) != len(clientSentVersions) {
		t.Fatalf("expected %d saved code states, got %d", len(clientSentVersions), len(store.savedPayload))
	}

	for i, p := range store.savedPayload {
		expectedVersion := int64(i + 1)
		if p.Version != expectedVersion {
			t.Errorf("step %d: expected server monotonic version %d, got %d", i, expectedVersion, p.Version)
		}
		expectedContent := fmt.Sprintf("content step %d", i+1)
		if p.Content != expectedContent {
			t.Errorf("step %d: expected content %q, got %q", i, expectedContent, p.Content)
		}
	}

	room.mu.RLock()
	lastState := room.lastCodeState
	room.mu.RUnlock()

	if lastState == nil || lastState.Version != 5 || lastState.Content != "content step 5" {
		t.Errorf("expected in-memory lastCodeState version 5 with 'content step 5', got %v", lastState)
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

	// Регистрируем локального клиента для проверки WebSocket-доставки
	client := NewClient("test-client-1", "user-1", "testuser", "candidate", "test-session", nil, room, logger)
	room.Register(client)

	// Ожидаем завершения регистрации
	deadlineReg := time.Now().Add(1 * time.Second)
	for time.Now().Before(deadlineReg) {
		room.mu.RLock()
		count := len(room.clients)
		room.mu.RUnlock()
		if count > 0 {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}

	// Очищаем sendCh от вступительных presence-сообщений
	for {
		select {
		case <-client.sendCh:
		default:
			goto drained
		}
	}
drained:

	// 1. Отправляем версии 1, 2, 3 по порядку через BroadcastFromRemote (версии уже назначены удаленной репликой)
	for v := int64(1); v <= 3; v++ {
		codeEnv := NewEnvelope(
			EventCodeUpdate,
			"test-session",
			fmt.Sprintf("req-%d", v),
			CodeUpdatePayload{
				FilePath: "main.ts",
				Content:  fmt.Sprintf("content v%d", v),
				Version:  v,
			},
		)
		bytes, _ := codeEnv.ToBytes()
		room.BroadcastFromRemote(bytes)
	}

	// 2. Отправляем устаревшую версию (Version: 2) с новым requestId — должна быть отклонена до client.Send и сохранения
	outdatedEnv := NewEnvelope(
		EventCodeUpdate,
		"test-session",
		"req-outdated-2",
		CodeUpdatePayload{
			FilePath: "main.ts",
			Content:  "outdated v2",
			Version:  2,
		},
	)
	bytes, _ := outdatedEnv.ToBytes()
	room.BroadcastFromRemote(bytes)

	// 3. Отправляем более новую версию (Version: 4) — должна быть сохранена и доставлена
	newEnv4 := NewEnvelope(
		EventCodeUpdate,
		"test-session",
		"req-4",
		CodeUpdatePayload{
			FilePath: "main.ts",
			Content:  "content v4",
			Version:  4,
		},
	)
	bytes, _ = newEnv4.ToBytes()
	room.BroadcastFromRemote(bytes)

	// 4. Отправляем дубликат версии (Version: 4) с новым requestId и другим контентом — должен быть отклонен
	duplicateEnv := NewEnvelope(
		EventCodeUpdate,
		"test-session",
		"req-duplicate-4",
		CodeUpdatePayload{
			FilePath: "main.ts",
			Content:  "duplicate v4",
			Version:  4,
		},
	)
	bytes, _ = duplicateEnv.ToBytes()
	room.BroadcastFromRemote(bytes)

	// 5. Отправляем версию 5 как барьер синхронизации: ее сохранение в mock store
	// строго подтверждает через FIFO очереди, что все предшествующие сообщения
	// были обработаны.
	newEnv5 := NewEnvelope(
		EventCodeUpdate,
		"test-session",
		"req-5",
		CodeUpdatePayload{
			FilePath: "main.ts",
			Content:  "content v5",
			Version:  5,
		},
	)
	bytes, _ = newEnv5.ToBytes()
	room.BroadcastFromRemote(bytes)

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		store.mu.Lock()
		count := len(store.savedPayload)
		store.mu.Unlock()
		if count >= 5 {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	// Должны быть сохранены только версии 1, 2, 3, 4, 5 (outdated version 2 и duplicate version 4 пропущены)
	if len(store.savedPayload) != 5 {
		t.Fatalf("expected 5 saved code states, got %d", len(store.savedPayload))
	}

	expectedVersions := []int64{1, 2, 3, 4, 5}
	for i, p := range store.savedPayload {
		if p.Version != expectedVersions[i] {
			t.Errorf("saved payload %d: expected version %d, got %d", i, expectedVersions[i], p.Version)
		}
		if p.Version == 4 && p.Content != "content v4" {
			t.Errorf("saved payload for version 4 was overwritten by duplicate: got content %q", p.Content)
		}
	}

	// Проверяем последнее состояние в памяти комнаты
	room.mu.RLock()
	lastState := room.lastCodeState
	room.mu.RUnlock()

	if lastState == nil || lastState.Version != 5 || lastState.Content != "content v5" {
		t.Errorf("expected in-memory lastCodeState version 5 with 'content v5', got %v", lastState)
	}

	// Проверяем доставку сообщений локальному клиенту в WebSocket (sendCh)
	var deliveredEnvelopes []RawEnvelope
	for {
		select {
		case msgBytes := <-client.sendCh:
			raw, parseErr := ParseRawEnvelope(msgBytes)
			if parseErr == nil && raw.Type == EventCodeUpdate {
				deliveredEnvelopes = append(deliveredEnvelopes, raw)
			}
		default:
			goto checkedClient
		}
	}
checkedClient:

	if len(deliveredEnvelopes) != 5 {
		t.Fatalf("expected 5 delivered code.update envelopes to client, got %d", len(deliveredEnvelopes))
	}

	expectedRequestIDs := []string{"req-1", "req-2", "req-3", "req-4", "req-5"}
	for i, env := range deliveredEnvelopes {
		if env.RequestID != expectedRequestIDs[i] {
			t.Errorf("delivered envelope %d has unexpected requestId %q, expected %q", i, env.RequestID, expectedRequestIDs[i])
		}
		payload, unpackErr := UnpackPayload[CodeUpdatePayload](env)
		if unpackErr != nil {
			t.Fatalf("failed to unpack delivered payload %d: %v", i, unpackErr)
		}
		if payload.Version != expectedVersions[i] {
			t.Errorf("delivered payload %d: expected version %d, got %d", i, expectedVersions[i], payload.Version)
		}
		if payload.Version == 4 && payload.Content != "content v4" {
			t.Errorf("delivered payload 4 content corrupted by duplicate: got %q", payload.Content)
		}
	}
}

type mockSlowSessionStore struct {
	mockSessionStoreOrder
	delay time.Duration
}

func (m *mockSlowSessionStore) SaveCodeState(ctx context.Context, sessionID string, data []byte) error {
	if m.delay > 0 {
		time.Sleep(m.delay)
	}
	return m.mockSessionStoreOrder.SaveCodeState(ctx, sessionID, data)
}

func TestRoom_CodeSave_QueueOverflow_Coalescing(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	store := &mockSlowSessionStore{
		delay: 5 * time.Millisecond,
	}
	room := NewRoom("test-overflow-session", nil, store, logger, nil)
	go room.Run(ctx)
	defer room.Close()

	// Отправляем 200 обновлений подряд (burst, гарантированно превышающий емкость очереди в 128 элементов)
	totalUpdates := int64(200)
	for v := int64(1); v <= totalUpdates; v++ {
		codeEnv := NewEnvelope(
			EventCodeUpdate,
			"test-overflow-session",
			"",
			CodeUpdatePayload{
				FilePath: "main.ts",
				Content:  fmt.Sprintf("content v%d", v),
				Version:  v,
			},
		)
		bytes, _ := codeEnv.ToBytes()
		room.Broadcast(bytes, "")
	}

	// Ожидаем, пока воркер через coalescing-слот сохранит самый последний снимок (v200)
	deadline := time.Now().Add(4 * time.Second)
	var lastSavedVersion int64
	for time.Now().Before(deadline) {
		store.mu.Lock()
		if len(store.savedPayload) > 0 {
			lastSavedVersion = store.savedPayload[len(store.savedPayload)-1].Version
		}
		store.mu.Unlock()
		if lastSavedVersion == totalUpdates {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	if len(store.savedPayload) == 0 {
		t.Fatal("no code payloads were saved in store")
	}

	lastPayload := store.savedPayload[len(store.savedPayload)-1]
	if lastPayload.Version != totalUpdates {
		t.Fatalf("expected last saved version to be %d, got %d", totalUpdates, lastPayload.Version)
	}
	if lastPayload.Content != "content v200" {
		t.Fatalf("expected last saved content to be 'content v200', got %q", lastPayload.Content)
	}

	// Проверяем состояние в памяти комнаты
	room.mu.RLock()
	lastState := room.lastCodeState
	room.mu.RUnlock()

	if lastState == nil || lastState.Version != totalUpdates || lastState.Content != "content v200" {
		t.Fatalf("expected in-memory lastCodeState version %d with 'content v200', got %v", totalUpdates, lastState)
	}
}

type mockFailingSessionStore struct {
	mockSessionStoreOrder
	failCount int
	calls     int
}

func (m *mockFailingSessionStore) SaveCodeState(ctx context.Context, sessionID string, data []byte) error {
	m.mu.Lock()
	m.calls++
	if m.calls <= m.failCount {
		m.mu.Unlock()
		return fmt.Errorf("simulated redis transient failure #%d", m.calls)
	}
	m.mu.Unlock()
	return m.mockSessionStoreOrder.SaveCodeState(ctx, sessionID, data)
}

func TestRoom_CodeSave_ErrorRetry(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	store := &mockFailingSessionStore{
		failCount: 2,
	}
	room := NewRoom("test-retry-session", nil, store, logger, nil)
	go room.Run(ctx)
	defer room.Close()

	codeEnv := NewEnvelope(
		EventCodeUpdate,
		"test-retry-session",
		"",
		CodeUpdatePayload{
			FilePath: "main.ts",
			Content:  "content v1 after retry",
			Version:  1,
		},
	)
	bytes, _ := codeEnv.ToBytes()
	room.Broadcast(bytes, "")

	// Ожидаем, пока воркер повторит попытку сохранения и успешно запишет снимок
	deadline := time.Now().Add(4 * time.Second)
	for time.Now().Before(deadline) {
		store.mu.Lock()
		count := len(store.savedPayload)
		store.mu.Unlock()
		if count >= 1 {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	if len(store.savedPayload) != 1 {
		t.Fatalf("expected 1 saved code state after retry, got %d (total calls: %d)", len(store.savedPayload), store.calls)
	}

	if store.savedPayload[0].Version != 1 || store.savedPayload[0].Content != "content v1 after retry" {
		t.Fatalf("saved payload mismatch: got %v", store.savedPayload[0])
	}
}

func TestRoom_MultiReplica_GlobalVersioningAndConditionalSave(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	sharedStore := &mockSessionStoreOrder{}

	// Создаем две реплики одной комнаты
	room1 := NewRoom("test-multi-replica-session", nil, sharedStore, logger, nil)
	room2 := NewRoom("test-multi-replica-session", nil, sharedStore, logger, nil)
	go room1.Run(ctx)
	go room2.Run(ctx)
	defer room1.Close()
	defer room2.Close()

	// Реплика 1 и Реплика 2 отправляют локальные обновления кода параллельно
	const updatesPerReplica = 10
	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		for i := 1; i <= updatesPerReplica; i++ {
			codeEnv := NewEnvelope(
				EventCodeUpdate,
				"test-multi-replica-session",
				"",
				CodeUpdatePayload{
					FilePath: "main.ts",
					Content:  fmt.Sprintf("content from replica 1 step %d", i),
					Version:  0,
				},
			)
			bytes, _ := codeEnv.ToBytes()
			room1.Broadcast(bytes, "")
			time.Sleep(5 * time.Millisecond)
		}
	}()

	go func() {
		defer wg.Done()
		for i := 1; i <= updatesPerReplica; i++ {
			codeEnv := NewEnvelope(
				EventCodeUpdate,
				"test-multi-replica-session",
				"",
				CodeUpdatePayload{
					FilePath: "main.ts",
					Content:  fmt.Sprintf("content from replica 2 step %d", i),
					Version:  0,
				},
			)
			bytes, _ := codeEnv.ToBytes()
			room2.Broadcast(bytes, "")
			time.Sleep(5 * time.Millisecond)
		}
	}()

	wg.Wait()

	// Ожидаем сохранения всех 20 обновлений
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		sharedStore.mu.Lock()
		count := len(sharedStore.savedPayload)
		sharedStore.mu.Unlock()
		if count >= 2*updatesPerReplica {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}

	sharedStore.mu.Lock()
	defer sharedStore.mu.Unlock()

	// Проверяем, что все сохраненные в хранилище версии строго монотонно возрастают без регрессий
	var prevVersion int64
	for i, p := range sharedStore.savedPayload {
		if p.Version <= prevVersion {
			t.Errorf("version sequence regression at step %d: prev=%d, current=%d", i, prevVersion, p.Version)
		}
		prevVersion = p.Version
	}

	// Финальная сохраненная версия обязана быть максимальной назначенной (2 * updatesPerReplica)
	if prevVersion != 2*updatesPerReplica {
		t.Fatalf("expected last saved version to be %d, got %d", 2*updatesPerReplica, prevVersion)
	}

	// Проверяем, что глобальный счетчик в хранилище инкрементировался ровно 20 раз
	if sharedStore.nextVersion != 2*updatesPerReplica {
		t.Fatalf("expected total allocated versions in store to be %d, got %d", 2*updatesPerReplica, sharedStore.nextVersion)
	}
}

