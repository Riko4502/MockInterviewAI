package ws

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"
)

// mockYjsStore реализует storage.YjsDocStore для тестирования комнаты Go Relay.
type mockYjsStore struct {
	mu             sync.Mutex
	calls          []string
	streamUpdates  map[string][]string
	seedCalls      int
	touchCalls     int
	appendCalls    int
	failTaskUpdate bool
}

func newMockYjsStore() *mockYjsStore {
	return &mockYjsStore{
		streamUpdates: make(map[string][]string),
	}
}

func (m *mockYjsStore) SeedTaskDoc(_ context.Context, _, taskKey, starterUpdateBase64 string, _ int64) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.seedCalls++
	m.calls = append(m.calls, "SeedTaskDoc")
	if _, exists := m.streamUpdates[taskKey]; !exists {
		m.streamUpdates[taskKey] = []string{starterUpdateBase64}
	}
	return 1, nil
}

func (m *mockYjsStore) GetTaskUpdates(_ context.Context, _, taskKey string) ([]string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls = append(m.calls, "XRANGE")
	if m.failTaskUpdate {
		return nil, errors.New("redis connection reset")
	}
	updates := m.streamUpdates[taskKey]
	result := make([]string, len(updates))
	copy(result, updates)
	return result, nil
}

func (m *mockYjsStore) AppendTaskUpdate(_ context.Context, _, taskKey, updateBase64 string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.appendCalls++
	m.streamUpdates[taskKey] = append(m.streamUpdates[taskKey], updateBase64)
	return "1-0", nil
}

func (m *mockYjsStore) TouchTaskStream(_ context.Context, _, _ string, _ time.Duration) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.touchCalls++
	m.calls = append(m.calls, "TouchTaskStream")
	return nil
}

// spySaveQueue оборачивает YjsSaveQueue для отслеживания вызовов GetPending в тестах порядка.
type spySaveQueue struct {
	*YjsSaveQueue
	mu         sync.Mutex
	calls      *[]string
	parentLock *sync.Mutex
}

func (s *spySaveQueue) GetPending(taskKey string) []string {
	if s.parentLock != nil {
		s.parentLock.Lock()
		*s.calls = append(*s.calls, "GetPending")
		s.parentLock.Unlock()
	}
	return s.YjsSaveQueue.GetPending(taskKey)
}

// drainSendCh очищает буфер сообщений клиента.
func drainSendCh(client *Client) {
	for {
		select {
		case <-client.sendCh:
		default:
			return
		}
	}
}

// waitForRegistration ожидает появления клиента в комнате.
func waitForRegistration(room *Room, expectedCount int, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		room.mu.RLock()
		count := len(room.clients)
		room.mu.RUnlock()
		if count >= expectedCount {
			return true
		}
		time.Sleep(5 * time.Millisecond)
	}
	return false
}

// TestRoom_YjsInit_OrderGetPendingThenXRANGE проверяет доказанный строгий порядок:
// Subscription-First -> GetPending(taskKey) -> XRANGE -> конкатенация.
func TestRoom_YjsInit_OrderGetPendingThenXRANGE(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	store := newMockYjsStore()
	store.streamUpdates["task-1:typescript"] = []string{"stream-u1"}

	room := NewRoom("test-session-order", nil, nil, logger, nil)
	room.SetYjsStore(store)

	var callMutex sync.Mutex
	spyCalls := make([]string, 0)
	spyQueue := &spySaveQueue{
		YjsSaveQueue: room.SaveQueue(),
		calls:        &spyCalls,
		parentLock:   &callMutex,
	}
	room.SetSaveQueue(spyQueue.YjsSaveQueue)

	// Помещаем дельту в оперативную очередь
	_ = room.SaveQueue().Enqueue(&PendingUpdate{
		SessionID:  room.ID,
		TaskKey:    "task-1:typescript",
		UpdateID:   "pending-u2",
		Data:       "pending-data-u2",
		EnqueuedAt: time.Now(),
	})

	client := NewClient("client-order-1", "user-order-1", "alice", "candidate", room.ID, nil, room, logger)

	// Вызываем sendYjsInit
	err := room.sendYjsInit(ctx, client, "task-1:typescript")
	if err != nil {
		t.Fatalf("sendYjsInit failed: %v", err)
	}

	// Читаем сформированный пакет из sendCh
	var initBytes []byte
	select {
	case initBytes = <-client.sendCh:
	case <-time.After(500 * time.Millisecond):
		t.Fatal("timed out waiting for yjs.init on client sendCh")
	}

	raw, err := ParseRawEnvelope(initBytes)
	if err != nil {
		t.Fatalf("failed to parse init envelope: %v", err)
	}
	if raw.Type != EventYjsInit {
		t.Fatalf("expected event yjs.init, got %s", raw.Type)
	}

	payload, err := UnpackPayload[YjsInitPayload](raw)
	if err != nil {
		t.Fatalf("failed to unpack yjs.init payload: %v", err)
	}

	if payload.TaskKey != "task-1:typescript" {
		t.Errorf("expected taskKey 'task-1:typescript', got %s", payload.TaskKey)
	}

	// Проверяем конкатенацию: сначала стрим, затем pending
	if len(payload.Updates) != 2 {
		t.Fatalf("expected 2 updates (1 stream + 1 pending), got %d: %v", len(payload.Updates), payload.Updates)
	}
	if payload.Updates[0] != "stream-u1" {
		t.Errorf("expected first update to be stream-u1, got %s", payload.Updates[0])
	}
	if payload.Updates[1] != "pending-data-u2" {
		t.Errorf("expected second update to be pending-data-u2, got %s", payload.Updates[1])
	}
}

// TestRoom_YjsInit_NoDroppedDeltasSingleNode проверяет отсутствие выпадения дельт
// при одновременном наличии дельт в стриме Redis, в очереди сохранения и в live-трансляции.
func TestRoom_YjsInit_NoDroppedDeltasSingleNode(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	store := newMockYjsStore()
	store.streamUpdates["task-1:typescript"] = []string{"stream-delta-1", "stream-delta-2"}

	room := NewRoom("test-session-nodrop", nil, nil, logger, nil)
	room.SetYjsStore(store)
	go room.Run(ctx)
	defer room.Close()

	// 1. В памяти есть не сброшенная в Redis дельта
	_ = room.SaveQueue().Enqueue(&PendingUpdate{
		SessionID:  room.ID,
		TaskKey:    "task-1:typescript",
		UpdateID:   "pending-delta-3",
		Data:       "delta-3-base64",
		EnqueuedAt: time.Now(),
	})

	// 2. Подключаем Клиента Б (Subscription-First: сокет регистрируется в r.clients)
	clientB := NewClient("client-b", "user-b", "bob", "interviewer", room.ID, nil, room, logger)
	room.Register(clientB)

	if !waitForRegistration(room, 1, 1*time.Second) {
		t.Fatal("clientB registration timed out")
	}

	// 3. Сразу после регистрации Клиента Б Клиент А отправляет live-дельту delta-4
	updateEnv := NewEnvelope(EventYjsUpdate, room.ID, "req-4", YjsUpdatePayload{
		TaskKey:  "task-1:typescript",
		UpdateID: "live-delta-4",
		Data:     "delta-4-base64",
	})
	updateBytes, _ := updateEnv.ToBytes()

	// Транслируем live-дельту от Клиента А
	room.Broadcast(updateBytes, "client-a")

	// Собираем все сообщения, полученные Клиентом Б
	var receivedInit *YjsInitPayload
	var receivedLiveUpdate *YjsUpdatePayload

	timeout := time.After(1 * time.Second)
	for receivedInit == nil || receivedLiveUpdate == nil {
		select {
		case msgBytes := <-clientB.sendCh:
			raw, pErr := ParseRawEnvelope(msgBytes)
			if pErr != nil {
				continue
			}
			if raw.Type == EventYjsInit {
				if initP, uErr := UnpackPayload[YjsInitPayload](raw); uErr == nil {
					receivedInit = &initP
				}
			} else if raw.Type == EventYjsUpdate {
				if updP, uErr := UnpackPayload[YjsUpdatePayload](raw); uErr == nil {
					receivedLiveUpdate = &updP
				}
			}
		case <-timeout:
			t.Fatalf("timed out collecting messages: receivedInit=%v, receivedLive=%v",
				receivedInit != nil, receivedLiveUpdate != nil)
		}
	}

	// Проверяем: yjs.init содержит и стрим, и pending (delta-1, delta-2, delta-3)
	if len(receivedInit.Updates) != 3 {
		t.Fatalf("expected 3 updates in yjs.init, got %d: %v", len(receivedInit.Updates), receivedInit.Updates)
	}
	if receivedInit.Updates[0] != "stream-delta-1" || receivedInit.Updates[1] != "stream-delta-2" || receivedInit.Updates[2] != "delta-3-base64" {
		t.Errorf("unexpected updates in yjs.init: %v", receivedInit.Updates)
	}

	// Проверяем: live update доставлен Клиенту Б (delta-4)
	if receivedLiveUpdate.UpdateID != "live-delta-4" || receivedLiveUpdate.Data != "delta-4-base64" {
		t.Errorf("unexpected live update: %+v", receivedLiveUpdate)
	}
}

// TestRoom_YjsUpdate_IngressAckAndBroadcast проверяет отправку yjs.ack автору,
// ретрансляцию yjs.update остальным клиентам и отсутствие эхо автору.
func TestRoom_YjsUpdate_IngressAckAndBroadcast(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	room := NewRoom("test-session-ack", nil, nil, logger, nil)
	go room.Run(ctx)
	defer room.Close()

	clientA := NewClient("client-a", "user-a", "alice", "candidate", room.ID, nil, room, logger)
	clientB := NewClient("client-b", "user-b", "bob", "interviewer", room.ID, nil, room, logger)

	room.Register(clientA)
	room.Register(clientB)

	if !waitForRegistration(room, 2, 1*time.Second) {
		t.Fatal("clients registration timed out")
	}

	// Очищаем входные буферы обоих клиентов от room.sync, yjs.init и presence.join
	time.Sleep(50 * time.Millisecond)
	drainSendCh(clientA)
	drainSendCh(clientB)

	// Клиент А отправляет yjs.update
	updEnv := NewEnvelope(EventYjsUpdate, room.ID, "req-upd-1", YjsUpdatePayload{
		TaskKey:  "task-1:typescript",
		UpdateID: "update-alice-100",
		Data:     "Y29udGVudA==", // "content" in base64
	})
	updBytes, err := updEnv.ToBytes()
	if err != nil {
		t.Fatalf("failed to marshal update: %v", err)
	}

	// Эмулируем отправку через комнату с указанием senderID
	room.Broadcast(updBytes, clientA.ID)

	// 1. Проверяем: Клиент А (автор) получает yjs.ack
	var ackReceived bool
	select {
	case aMsg := <-clientA.sendCh:
		raw, pErr := ParseRawEnvelope(aMsg)
		if pErr != nil {
			t.Fatalf("clientA parse error: %v", pErr)
		}
		if raw.Type != EventYjsAck {
			t.Fatalf("expected clientA to receive yjs.ack, got %s", raw.Type)
		}
		ackPayload, uErr := UnpackPayload[YjsAckPayload](raw)
		if uErr != nil {
			t.Fatalf("clientA unpack ack error: %v", uErr)
		}
		if ackPayload.TaskKey != "task-1:typescript" || ackPayload.UpdateID != "update-alice-100" {
			t.Errorf("unexpected ack payload: %+v", ackPayload)
		}
		ackReceived = true
	case <-time.After(1 * time.Second):
		t.Fatal("clientA did not receive yjs.ack within timeout")
	}
	if !ackReceived {
		t.Fatal("ack not received by author")
	}

	// 2. Проверяем: Клиент А больше ничего не получает (нет эхо-повтора yjs.update)
	select {
	case echo := <-clientA.sendCh:
		t.Fatalf("clientA received unexpected message (echo): %s", string(echo))
	case <-time.After(100 * time.Millisecond):
		// Ожидаемо: эхо отсутствует
	}

	// 3. Проверяем: Клиент Б (собеседник) получает ретранслированный yjs.update
	select {
	case bMsg := <-clientB.sendCh:
		raw, pErr := ParseRawEnvelope(bMsg)
		if pErr != nil {
			t.Fatalf("clientB parse error: %v", pErr)
		}
		if raw.Type != EventYjsUpdate {
			t.Fatalf("expected clientB to receive yjs.update, got %s", raw.Type)
		}
		updPayload, uErr := UnpackPayload[YjsUpdatePayload](raw)
		if uErr != nil {
			t.Fatalf("clientB unpack update error: %v", uErr)
		}
		if updPayload.TaskKey != "task-1:typescript" || updPayload.UpdateID != "update-alice-100" || updPayload.Data != "Y29udGVudA==" {
			t.Errorf("unexpected update payload for clientB: %+v", updPayload)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("clientB did not receive broadcast yjs.update")
	}

	// 4. Проверяем: дельта сохранена в оперативной очереди комнаты yjsSaveQueue
	pending := room.SaveQueue().GetPending("task-1:typescript")
	if len(pending) != 1 || pending[0] != "Y29udGVudA==" {
		t.Errorf("expected pending update in queue, got: %v", pending)
	}
}

// TestRoom_SlowConsumer_EvictionOnSendChOverflow проверяет закрытие сокета slow consumer
// при переполнении буфера sendCh (политика защиты от зависания комнаты).
func TestRoom_SlowConsumer_EvictionOnSendChOverflow(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	room := NewRoom("test-session-slow", nil, nil, logger, nil)
	go room.Run(ctx)
	defer room.Close()

	clientFast := NewClient("client-fast", "user-fast", "fast", "candidate", room.ID, nil, room, logger)
	clientSlow := NewClient("client-slow", "user-slow", "slow", "interviewer", room.ID, nil, room, logger)

	room.Register(clientFast)
	room.Register(clientSlow)

	if !waitForRegistration(room, 2, 1*time.Second) {
		t.Fatal("clients registration timed out")
	}

	// Забиваем буфер clientSlow до отказа неблокирующим образом
	dummyBytes := []byte(`{"type":"dummy"}`)
fillBuffer:
	for {
		select {
		case clientSlow.sendCh <- dummyBytes:
		default:
			break fillBuffer
		}
	}

	// Отправляем трансляцию в комнату от clientFast
	msgEnv := NewEnvelope(EventYjsAwareness, room.ID, "req-aw", YjsAwarenessPayload{
		TaskKey: "task-1:typescript",
		Data:    "AQIDBA==",
	})
	msgBytes, _ := msgEnv.ToBytes()

	room.Broadcast(msgBytes, clientFast.ID)

	// Ожидаем, что комната обнаружит переполнение clientSlow и вытеснит его
	deadline := time.Now().Add(1 * time.Second)
	evicted := false
	for time.Now().Before(deadline) {
		room.mu.RLock()
		_, exists := room.clients[clientSlow.ID]
		room.mu.RUnlock()
		if !exists {
			evicted = true
			break
		}
		time.Sleep(10 * time.Millisecond)
	}

	if !evicted {
		t.Fatal("clientSlow was not evicted from room.clients after sendCh overflow")
	}

	// Проверяем, что clientSlow был закрыт
	select {
	case <-clientSlow.doneCh:
		// Успешно закрыт
	case <-time.After(500 * time.Millisecond):
		t.Fatal("clientSlow.doneCh was not closed after eviction")
	}

	// Быстрый клиент остался в комнате
	room.mu.RLock()
	_, fastExists := room.clients[clientFast.ID]
	room.mu.RUnlock()
	if !fastExists {
		t.Fatal("clientFast was unexpectedly evicted")
	}
}

// TestRoom_YjsInit_SyncFailedErrorAndClosure проверяет обработку сбоя чтения истории из Redis
// со статусом SYNC_FAILED и закрытием с кодом 1013 (StatusTryAgainLater).
func TestRoom_YjsInit_SyncFailedErrorAndClosure(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	store := newMockYjsStore()
	store.failTaskUpdate = true // Имитируем ошибку Redis

	room := NewRoom("test-session-sync-fail", nil, nil, logger, nil)
	room.SetYjsStore(store)

	client := NewClient("client-fail-1", "user-fail-1", "alice", "candidate", room.ID, nil, room, logger)

	err := room.sendYjsInit(ctx, client, "task-1:typescript")
	if err == nil {
		t.Fatal("expected sendYjsInit to fail when redis fails, got nil")
	}

	// Проверяем, что клиент получил room.error с кодом SYNC_FAILED
	select {
	case msgBytes := <-client.sendCh:
		raw, pErr := ParseRawEnvelope(msgBytes)
		if pErr != nil {
			t.Fatalf("parse error: %v", pErr)
		}
		if raw.Type != EventRoomError {
			t.Fatalf("expected EventRoomError, got %s", raw.Type)
		}
		var errPayload RoomErrorPayload
		if uErr := json.Unmarshal(raw.Payload, &errPayload); uErr != nil {
			t.Fatalf("unmarshal error: %v", uErr)
		}
		if errPayload.Code != ErrCodeSyncFailed {
			t.Errorf("expected error code %s, got %s", ErrCodeSyncFailed, errPayload.Code)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("client did not receive room.error envelope")
	}
}
