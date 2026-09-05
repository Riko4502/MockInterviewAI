package sse

import (
	"log/slog"
	"sync"
	"sync/atomic"
	"time"
)

// Client представляет одно активное SSE-соединение (одну вкладку пользователя).
//
// Доставка в клиента всегда неблокирующая: события кладутся в кольцевой буфер
// ограниченной емкости, поэтому медленный потребитель не может застопорить
// горутину вычитки Redis Stream, общую для всех вкладок пользователя.
type Client struct {
	ID          string
	UserID      string
	IP          string
	ConnectedAt time.Time

	send chan *Envelope
	done chan struct{}

	closeOnce   sync.Once
	closeReason atomic.Value

	dropped     atomic.Int64
	firstDropAt atomic.Int64

	slowConsumerGrace time.Duration
	metrics           *Metrics
	logger            *slog.Logger

	// redisReserved отмечает, что для соединения был инкрементирован
	// кластерный счетчик user:{userId}:sse_count и его нужно вернуть при выходе.
	redisReserved bool
}

// NewClient создает SSE-клиента с кольцевым буфером указанной емкости.
func NewClient(
	id, userID, clientIP string,
	bufferSize int,
	slowConsumerGrace time.Duration,
	metrics *Metrics,
	logger *slog.Logger,
) *Client {
	if bufferSize <= 0 {
		bufferSize = defaultClientBufferSize
	}

	if metrics == nil {
		metrics = NewMetrics("unknown")
	}

	return &Client{
		ID:                id,
		UserID:            userID,
		IP:                clientIP,
		ConnectedAt:       time.Now(),
		send:              make(chan *Envelope, bufferSize),
		done:              make(chan struct{}),
		slowConsumerGrace: slowConsumerGrace,
		metrics:           metrics,
		logger: logger.With(
			slog.String("sseClientId", id),
			slog.String("userId", userID),
		),
	}
}

// Send пытается положить событие в буфер клиента без блокировки.
// Возвращает false, если соединение уже закрыто или буфер переполнен.
func (c *Client) Send(env *Envelope) bool {
	select {
	case <-c.done:
		c.metrics.IncDropped(DropReasonClosed)
		return false
	default:
	}

	select {
	case c.send <- env:
		// Буфер разгрузился — снимаем отметку начала переполнения.
		c.firstDropAt.Store(0)
		return true
	default:
		c.handleOverflow()
		return false
	}
}

// handleOverflow учитывает отброшенное событие и закрывает соединение, если
// буфер остается переполненным дольше отведенного времени. Клиент переподключится
// сам и доберет пропущенное через Last-Event-ID.
func (c *Client) handleOverflow() {
	c.dropped.Add(1)
	c.metrics.IncDropped(DropReasonSlowConsumer)

	now := time.Now().UnixNano()

	if c.firstDropAt.CompareAndSwap(0, now) {
		c.logger.Warn("sse client buffer overflow, dropping message",
			slog.Int64("droppedTotal", c.dropped.Load()),
		)
		return
	}

	firstDropAt := c.firstDropAt.Load()
	if firstDropAt == 0 || c.slowConsumerGrace <= 0 {
		return
	}

	if time.Duration(now-firstDropAt) >= c.slowConsumerGrace {
		c.logger.Warn("closing slow sse consumer: send buffer stayed full",
			slog.Duration("grace", c.slowConsumerGrace),
			slog.Int64("droppedTotal", c.dropped.Load()),
		)
		c.Close("slow consumer: send buffer overflow")
	}
}

// Close помечает соединение закрытым. Горутина записи допишет уже накопленные
// в буфере кадры и завершит HTTP-поток.
func (c *Client) Close(reason string) {
	c.closeOnce.Do(func() {
		c.closeReason.Store(reason)
		close(c.done)
	})
}

// Events возвращает канал исходящих событий клиента.
func (c *Client) Events() <-chan *Envelope {
	return c.send
}

// Done возвращает канал, закрывающийся при завершении соединения.
func (c *Client) Done() <-chan struct{} {
	return c.done
}

// CloseReason возвращает причину закрытия соединения (пустая строка, если оно активно).
func (c *Client) CloseReason() string {
	if reason, ok := c.closeReason.Load().(string); ok {
		return reason
	}

	return ""
}

// Dropped возвращает количество событий, отброшенных из-за переполнения буфера.
func (c *Client) Dropped() int64 {
	return c.dropped.Load()
}
