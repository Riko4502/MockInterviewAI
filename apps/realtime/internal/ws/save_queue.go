package ws

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/mockinterviewai/realtime/internal/storage"
)

const (
	// MaxSaveQueueSize - максимальная ёмкость очереди асинхронной записи в память (10 000).
	MaxSaveQueueSize = 10000

	// DefaultFlushInterval - интервал сброса очереди в Redis (50 мс).
	DefaultFlushInterval = 50 * time.Millisecond

	// MaxBatchSize - максимальный размер пакета дельт за одну итерацию сброса.
	MaxBatchSize = 100

	// StreamTTL - время жизни стрима при обновлении дельт (24 часа).
	StreamTTL = 24 * time.Hour
)

var (
	// ErrSaveQueueFull возвращается при переполнении очереди сохранения дельт.
	ErrSaveQueueFull = errors.New("yjs save queue is full")
)

// PendingUpdate представляет отдельную дельту Yjs, ожидающую записи в Redis Stream.
type PendingUpdate struct {
	SessionID  string
	TaskKey    string
	UpdateID   string
	Data       string // Base64-encoded Yjs delta
	EnqueuedAt time.Time
}

// YjsSaveQueue представляет потокобезопасную асинхронную очередь накопления и сброса дельт Yjs.
type YjsSaveQueue struct {
	mu            sync.RWMutex
	pending       map[string][]*PendingUpdate
	totalPending  int
	maxSize       int
	flushInterval time.Duration
	batchSize     int

	store   storage.YjsDocStore
	logger  *slog.Logger
	notifyC chan struct{}
	doneC   chan struct{}
}

// NewYjsSaveQueue создает новый экземпляр очереди с заданным хранилищем.
func NewYjsSaveQueue(store storage.YjsDocStore, logger *slog.Logger) *YjsSaveQueue {
	return &YjsSaveQueue{
		pending:       make(map[string][]*PendingUpdate),
		maxSize:       MaxSaveQueueSize,
		flushInterval: DefaultFlushInterval,
		batchSize:     MaxBatchSize,
		store:         store,
		logger:        logger.With(slog.String("component", "yjsSaveQueue")),
		notifyC:       make(chan struct{}, 1),
		doneC:         make(chan struct{}),
	}
}

// SetStore обновляет хранилище YjsDocStore.
func (q *YjsSaveQueue) SetStore(store storage.YjsDocStore) {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.store = store
}

// Enqueue добавляет дельту в очередь под эксклюзивной блокировкой mu.Lock().
func (q *YjsSaveQueue) Enqueue(update *PendingUpdate) error {
	q.mu.Lock()
	defer q.mu.Unlock()

	if q.totalPending >= q.maxSize {
		return ErrSaveQueueFull
	}

	q.pending[update.TaskKey] = append(q.pending[update.TaskKey], update)
	q.totalPending++

	select {
	case q.notifyC <- struct{}{}:
	default:
	}

	return nil
}

// GetPending самостоятельно инкапсулирует mu.RLock() и возвращает изолированную shallow copy
// строковых Base64-дельт для запрошенного taskKey.
// Вызывающий код в room.go НЕ управляет мьютексом очереди напрямую.
func (q *YjsSaveQueue) GetPending(taskKey string) []string {
	q.mu.RLock()
	defer q.mu.RUnlock()

	items, exists := q.pending[taskKey]
	if !exists || len(items) == 0 {
		return nil
	}

	result := make([]string, len(items))
	for i, item := range items {
		result[i] = item.Data
	}
	return result
}

// CommitBatch удаляет подтвержденный срез очереди под mu.Lock() СТРОГО ПОСЛЕ успешного ответа XADD.
func (q *YjsSaveQueue) CommitBatch(taskKey string, count int) {
	q.mu.Lock()
	defer q.mu.Unlock()

	items, exists := q.pending[taskKey]
	if !exists || len(items) == 0 || count <= 0 {
		return
	}

	if count >= len(items) {
		delete(q.pending, taskKey)
		q.totalPending -= len(items)
	} else {
		q.pending[taskKey] = items[count:]
		q.totalPending -= count
	}
}

// TotalPending возвращает текущее общее число дельт в очереди под RLock.
func (q *YjsSaveQueue) TotalPending() int {
	q.mu.RLock()
	defer q.mu.RUnlock()
	return q.totalPending
}

// PendingKeys возвращает список taskKey, имеющих не сброшенные дельты.
func (q *YjsSaveQueue) PendingKeys() []string {
	q.mu.RLock()
	defer q.mu.RUnlock()

	keys := make([]string, 0, len(q.pending))
	for k, items := range q.pending {
		if len(items) > 0 {
			keys = append(keys, k)
		}
	}
	return keys
}

// getBatch извлекает срез до batchSize элементов для указанного taskKey под RLock.
func (q *YjsSaveQueue) getBatch(taskKey string) []*PendingUpdate {
	q.mu.RLock()
	defer q.mu.RUnlock()

	items := q.pending[taskKey]
	if len(items) == 0 {
		return nil
	}

	n := min(len(items), q.batchSize)

	batch := make([]*PendingUpdate, n)
	copy(batch, items[:n])
	return batch
}

// FlushSync выполняет одну синхронную итерацию сброса накопленных дельт в Redis.
func (q *YjsSaveQueue) FlushSync(ctx context.Context) {
	q.mu.RLock()
	store := q.store
	q.mu.RUnlock()
	if store == nil {
		return
	}

	keys := q.PendingKeys()
	for _, taskKey := range keys {
		batch := q.getBatch(taskKey)
		if len(batch) == 0 {
			continue
		}

		committedCount := 0
		for _, update := range batch {
			_, err := store.AppendTaskUpdate(ctx, update.SessionID, update.TaskKey, update.Data)
			if err != nil {
				q.logger.Warn("failed to append task update to redis stream",
					slog.String("sessionId", update.SessionID),
					slog.String("taskKey", update.TaskKey),
					slog.String("updateId", update.UpdateID),
					slog.String("error", err.Error()),
				)
				break
			}
			committedCount++
		}

		if committedCount > 0 {
			// Инвариант: дельта удаляется из pending СТРОГО ПОСЛЕ успешного XADD
			q.CommitBatch(taskKey, committedCount)

			// Продлеваем TTL стрима и хэша сессии на 24 часа
			if err := store.TouchTaskStream(ctx, batch[0].SessionID, taskKey, StreamTTL); err != nil {
				q.logger.Warn("failed to touch task stream TTL after flush",
					slog.String("taskKey", taskKey),
					slog.String("error", err.Error()),
				)
			}
		}
	}
}

// Start запускает фоновый процесс сброса дельт по таймеру или сигналу.
func (q *YjsSaveQueue) Start(ctx context.Context) {
	ticker := time.NewTicker(q.flushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			q.finalFlush()
			return
		case <-q.doneC:
			q.finalFlush()
			return
		case <-ticker.C:
			q.FlushSync(ctx)
		case <-q.notifyC:
			q.FlushSync(ctx)
		}
	}
}

// finalFlush выполняет сброс оставшихся в памяти дельт при остановке процесса или контекста.
func (q *YjsSaveQueue) finalFlush() {
	flushCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	for q.TotalPending() > 0 && flushCtx.Err() == nil {
		before := q.TotalPending()
		q.FlushSync(flushCtx)
		if q.TotalPending() >= before {
			break // Redis недоступен или ошибка записи — прекращаем попытки
		}
	}
}

// Close останавливает фоновый цикл сброса.
func (q *YjsSaveQueue) Close() {
	select {
	case <-q.doneC:
	default:
		close(q.doneC)
	}
}
