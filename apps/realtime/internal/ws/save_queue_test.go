package ws

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"
)

// mockYjsDocStore реализует storage.YjsDocStore для тестирования saveQueue.
type mockYjsDocStore struct {
	mu          sync.Mutex
	appended    []string
	failAppend  bool
	appendDelay time.Duration
	touchCalls  int
}

func (m *mockYjsDocStore) SeedTaskDoc(ctx context.Context, sessionID, taskKey, starterUpdateBase64 string, ttlSeconds int64) (int, error) {
	return 1, nil
}

func (m *mockYjsDocStore) GetTaskUpdates(ctx context.Context, sessionID, taskKey string) ([]string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	res := make([]string, len(m.appended))
	copy(res, m.appended)
	return res, nil
}

func (m *mockYjsDocStore) AppendTaskUpdate(ctx context.Context, sessionID, taskKey, updateBase64 string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.appendDelay > 0 {
		time.Sleep(m.appendDelay)
	}

	if m.failAppend {
		return "", errors.New("redis connection refused")
	}

	m.appended = append(m.appended, updateBase64)
	return fmt.Sprintf("1000-%d", len(m.appended)), nil
}

func (m *mockYjsDocStore) CompactTaskStream(ctx context.Context, sessionID, taskKey, snapshotBase64 string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.appended = []string{snapshotBase64}
	return nil
}

func (m *mockYjsDocStore) TouchTaskStream(ctx context.Context, sessionID, taskKey string, ttl time.Duration) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.touchCalls++
	return nil
}

func TestYjsSaveQueue_Basic(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	store := &mockYjsDocStore{}
	queue := NewYjsSaveQueue(store, logger)
	defer queue.Close()

	taskKey := "task-1:typescript"
	sessionID := "session-1"

	// 1. Очередь пуста
	if pending := queue.GetPending(taskKey); pending != nil {
		t.Fatalf("expected nil for empty queue, got %v", pending)
	}
	if queue.TotalPending() != 0 {
		t.Errorf("expected 0 total pending, got %d", queue.TotalPending())
	}

	// 2. Добавление дельт
	err := queue.Enqueue(&PendingUpdate{
		SessionID: sessionID,
		TaskKey:   taskKey,
		UpdateID:  "u-1",
		Data:      "delta-1",
	})
	if err != nil {
		t.Fatalf("unexpected enqueue error: %v", err)
	}

	err = queue.Enqueue(&PendingUpdate{
		SessionID: sessionID,
		TaskKey:   taskKey,
		UpdateID:  "u-2",
		Data:      "delta-2",
	})
	if err != nil {
		t.Fatalf("unexpected enqueue error: %v", err)
	}

	if queue.TotalPending() != 2 {
		t.Errorf("expected 2 total pending, got %d", queue.TotalPending())
	}

	// 3. GetPending возвращает изолированную shallow copy
	pending := queue.GetPending(taskKey)
	if len(pending) != 2 || pending[0] != "delta-1" || pending[1] != "delta-2" {
		t.Errorf("expected [delta-1, delta-2], got %v", pending)
	}

	// Модификация возвращенного среза не меняет очередь
	pending[0] = "corrupted"
	freshPending := queue.GetPending(taskKey)
	if freshPending[0] != "delta-1" {
		t.Errorf("expected isolation, but internal queue was modified!")
	}

	// 4. CommitBatch удаляет подтвержденные дельты
	queue.CommitBatch(taskKey, 1)
	freshPending = queue.GetPending(taskKey)
	if len(freshPending) != 1 || freshPending[0] != "delta-2" {
		t.Errorf("expected [delta-2] after committing 1 item, got %v", freshPending)
	}
	if queue.TotalPending() != 1 {
		t.Errorf("expected 1 total pending, got %d", queue.TotalPending())
	}

	queue.CommitBatch(taskKey, 1)
	if queue.GetPending(taskKey) != nil {
		t.Errorf("expected nil after committing all items")
	}
	if queue.TotalPending() != 0 {
		t.Errorf("expected 0 total pending, got %d", queue.TotalPending())
	}
}

func TestYjsSaveQueue_QueueFull(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	store := &mockYjsDocStore{}
	queue := NewYjsSaveQueue(store, logger)
	defer queue.Close()
	queue.maxSize = 3 // Ограничиваем емкость для теста

	taskKey := "task-1:typescript"
	sessionID := "session-1"

	for i := 1; i <= 3; i++ {
		err := queue.Enqueue(&PendingUpdate{
			SessionID: sessionID,
			TaskKey:   taskKey,
			UpdateID:  fmt.Sprintf("u-%d", i),
			Data:      fmt.Sprintf("data-%d", i),
		})
		if err != nil {
			t.Fatalf("unexpected enqueue error on item %d: %v", i, err)
		}
	}

	// 4-й элемент должен вернуть ErrSaveQueueFull
	err := queue.Enqueue(&PendingUpdate{
		SessionID: sessionID,
		TaskKey:   taskKey,
		UpdateID:  "u-4",
		Data:      "data-4",
	})
	if !errors.Is(err, ErrSaveQueueFull) {
		t.Errorf("expected ErrSaveQueueFull, got %v", err)
	}
}

func TestYjsSaveQueue_RetentionUntilXADD(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	store := &mockYjsDocStore{
		failAppend: true, // Имитируем сбой Redis
	}
	queue := NewYjsSaveQueue(store, logger)
	defer queue.Close()

	taskKey := "task-1:typescript"
	sessionID := "session-1"

	_ = queue.Enqueue(&PendingUpdate{
		SessionID: sessionID,
		TaskKey:   taskKey,
		UpdateID:  "u-1",
		Data:      "delta-retained-on-failure",
	})

	// Выполняем синхронный сброс, который натыкается на ошибку AppendTaskUpdate
	queue.FlushSync(context.Background())

	// Дельта НЕ должна удаляться из очереди, так как XADD не ответил успешно
	pending := queue.GetPending(taskKey)
	if len(pending) != 1 || pending[0] != "delta-retained-on-failure" {
		t.Fatalf("delta was prematurely committed on failure: %v", pending)
	}

	// Теперь чиним Redis и снова делаем flush
	store.failAppend = false
	queue.FlushSync(context.Background())

	// Теперь дельта успешно сброшена и удалена
	pending = queue.GetPending(taskKey)
	if len(pending) != 0 {
		t.Errorf("expected empty pending after successful flush, got %v", pending)
	}

	// Проверяем, что в store дельта реально поступила
	updates, _ := store.GetTaskUpdates(context.Background(), sessionID, taskKey)
	if len(updates) != 1 || updates[0] != "delta-retained-on-failure" {
		t.Errorf("expected delta in store, got %v", updates)
	}
}

func TestYjsSaveQueue_ConcurrencyAndDeadlockFree(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	store := &mockYjsDocStore{}
	queue := NewYjsSaveQueue(store, logger)
	defer queue.Close()

	var wg sync.WaitGroup
	const (
		numProducers  = 10
		numReaders    = 10
		numCommitters = 5
		iterations    = 100
	)

	// Producers: Enqueue
	for p := 0; p < numProducers; p++ {
		wg.Add(1)
		go func(prodID int) {
			defer wg.Done()
			taskKey := fmt.Sprintf("task-%d:typescript", prodID%3)
			for i := 0; i < iterations; i++ {
				_ = queue.Enqueue(&PendingUpdate{
					SessionID: "session-concurrent",
					TaskKey:   taskKey,
					UpdateID:  fmt.Sprintf("p%d-u%d", prodID, i),
					Data:      fmt.Sprintf("data-p%d-u%d", prodID, i),
				})
			}
		}(p)
	}

	// Readers: GetPending
	for r := 0; r < numReaders; r++ {
		wg.Add(1)
		go func(readerID int) {
			defer wg.Done()
			taskKey := fmt.Sprintf("task-%d:typescript", readerID%3)
			for i := 0; i < iterations; i++ {
				pending := queue.GetPending(taskKey)
				_ = len(pending)
			}
		}(r)
	}

	// Committers: CommitBatch
	for c := 0; c < numCommitters; c++ {
		wg.Add(1)
		go func(committerID int) {
			defer wg.Done()
			taskKey := fmt.Sprintf("task-%d:typescript", committerID%3)
			for i := 0; i < iterations; i++ {
				queue.CommitBatch(taskKey, 2)
			}
		}(c)
	}

	// Ожидаем завершения всех горутин без deadlock
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		// Успешно завершились без взаимных блокировок
	case <-time.After(5 * time.Second):
		t.Fatal("deadlock detected in concurrent YjsSaveQueue access!")
	}
}
