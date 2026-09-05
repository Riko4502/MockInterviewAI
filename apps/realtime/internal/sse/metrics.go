package sse

import (
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
)

// Причины отбрасывания сообщений (лейбл reason метрики dropped_messages_total).
const (
	// DropReasonSlowConsumer — переполнение кольцевого буфера медленного клиента.
	DropReasonSlowConsumer = "slow_consumer"

	// DropReasonClosed — соединение уже закрывалось в момент доставки события.
	DropReasonClosed = "closed"
)

// Статусы попытки подключения (лейбл status метрики connections_total).
const (
	// ConnStatusSuccess — соединение установлено.
	ConnStatusSuccess = "success"

	// ConnStatusRejected — соединение отклонено (лимиты, авторизация, возможности транспорта).
	ConnStatusRejected = "rejected"
)

// latencyBuckets — границы гистограмм задержек в секундах.
var latencyBuckets = []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10}

// durationBuckets — границы гистограммы длительности удержания SSE-сессии в секундах.
var durationBuckets = []float64{1, 5, 15, 30, 60, 300, 900, 1800, 3600, 7200, 21600}

// Metrics агрегирует SRE-метрики SSE-подсистемы (см. SSE_SPEC.md, раздел 8).
//
// Счетчики реализованы без клиентской библиотеки Prometheus: экспорт выполняется
// напрямую в текстовом формате экспозиции, что не добавляет сервису зависимостей.
type Metrics struct {
	nodeID string

	connectedClients    atomic.Int64
	activeUsers         atomic.Int64
	connectionsSuccess  atomic.Int64
	connectionsRejected atomic.Int64

	mu         sync.Mutex
	dispatched map[string]int64
	dropped    map[string]int64

	streamLag       *histogram
	sessionDuration *histogram
}

// NewMetrics создает набор метрик, помеченных идентификатором текущей ноды.
func NewMetrics(nodeID string) *Metrics {
	if nodeID == "" {
		nodeID = "unknown"
	}

	return &Metrics{
		nodeID:          nodeID,
		dispatched:      make(map[string]int64),
		dropped:         make(map[string]int64),
		streamLag:       newHistogram(latencyBuckets),
		sessionDuration: newHistogram(durationBuckets),
	}
}

// IncConnectedClients увеличивает число активных SSE-клиентов на ноде.
func (m *Metrics) IncConnectedClients() {
	m.connectedClients.Add(1)
}

// DecConnectedClients уменьшает число активных SSE-клиентов на ноде.
func (m *Metrics) DecConnectedClients() {
	m.connectedClients.Add(-1)
}

// SetActiveUsers обновляет число уникальных пользователей с открытыми SSE-потоками.
func (m *Metrics) SetActiveUsers(count int) {
	m.activeUsers.Store(int64(count))
}

// IncConnections увеличивает счетчик попыток подключения с указанным статусом.
func (m *Metrics) IncConnections(status string) {
	if status == ConnStatusRejected {
		m.connectionsRejected.Add(1)
		return
	}

	m.connectionsSuccess.Add(1)
}

// IncDispatched увеличивает счетчик отправленных сообщений по типу события.
func (m *Metrics) IncDispatched(eventType string) {
	m.mu.Lock()
	m.dispatched[eventType]++
	m.mu.Unlock()
}

// IncDropped увеличивает счетчик отброшенных сообщений с указанной причиной.
func (m *Metrics) IncDropped(reason string) {
	m.mu.Lock()
	m.dropped[reason]++
	m.mu.Unlock()
}

// ObserveStreamLag фиксирует задержку между публикацией события в Redis Stream
// и его доставкой подписчикам ноды.
func (m *Metrics) ObserveStreamLag(seconds float64) {
	m.streamLag.observe(seconds)
}

// ObserveSessionDuration фиксирует время удержания SSE-соединения клиентом.
func (m *Metrics) ObserveSessionDuration(seconds float64) {
	m.sessionDuration.observe(seconds)
}

// ConnectedClients возвращает текущее число активных SSE-клиентов на ноде.
func (m *Metrics) ConnectedClients() int {
	return int(m.connectedClients.Load())
}

// ActiveUsers возвращает текущее число уникальных пользователей с открытыми SSE-потоками.
func (m *Metrics) ActiveUsers() int {
	return int(m.activeUsers.Load())
}

// WritePrometheus выводит все метрики SSE в текстовом формате экспозиции Prometheus.
func (m *Metrics) WritePrometheus(w io.Writer) {
	node := escapeLabelValue(m.nodeID)
	var buf strings.Builder

	writeGauge(&buf, "realtime_sse_connected_clients",
		"Current number of active SSE clients on the node",
		`node_id="`+node+`"`, m.connectedClients.Load())

	writeGauge(&buf, "realtime_sse_active_users",
		"Number of unique users with at least one open SSE stream",
		`node_id="`+node+`"`, m.activeUsers.Load())

	buf.WriteString("# HELP realtime_sse_connections_total Total number of SSE connection attempts\n")
	buf.WriteString("# TYPE realtime_sse_connections_total counter\n")
	writeSample(&buf, "realtime_sse_connections_total",
		`status="`+ConnStatusSuccess+`"`, m.connectionsSuccess.Load())
	writeSample(&buf, "realtime_sse_connections_total",
		`status="`+ConnStatusRejected+`"`, m.connectionsRejected.Load())

	m.mu.Lock()
	dispatched := sortedPairs(m.dispatched)
	dropped := sortedPairs(m.dropped)
	m.mu.Unlock()

	buf.WriteString("# HELP realtime_sse_messages_dispatched_total Total number of SSE messages dispatched by event type\n")
	buf.WriteString("# TYPE realtime_sse_messages_dispatched_total counter\n")
	for _, pair := range dispatched {
		writeSample(&buf, "realtime_sse_messages_dispatched_total",
			`event_type="`+escapeLabelValue(pair.key)+`"`, pair.value)
	}

	buf.WriteString("# HELP realtime_sse_dropped_messages_total Total number of SSE messages dropped before delivery\n")
	buf.WriteString("# TYPE realtime_sse_dropped_messages_total counter\n")
	for _, pair := range dropped {
		writeSample(&buf, "realtime_sse_dropped_messages_total",
			`reason="`+escapeLabelValue(pair.key)+`"`, pair.value)
	}

	m.streamLag.write(&buf, "realtime_sse_redis_stream_lag_seconds",
		"Delay between event publication in Redis Streams and its dispatch",
		`stream="user_notifications"`)

	m.sessionDuration.write(&buf, "realtime_sse_session_duration_seconds",
		"How long clients keep an SSE connection open",
		`node_id="`+node+`"`)

	_, _ = io.WriteString(w, buf.String())
}

type labeledValue struct {
	key   string
	value int64
}

func sortedPairs(source map[string]int64) []labeledValue {
	pairs := make([]labeledValue, 0, len(source))
	for key, value := range source {
		pairs = append(pairs, labeledValue{key: key, value: value})
	}

	sort.Slice(pairs, func(i, j int) bool {
		return pairs[i].key < pairs[j].key
	})

	return pairs
}

func writeGauge(buf *strings.Builder, name, help, labels string, value int64) {
	fmt.Fprintf(buf, "# HELP %s %s\n# TYPE %s gauge\n", name, help, name)
	writeSample(buf, name, labels, value)
}

func writeSample(buf *strings.Builder, name, labels string, value int64) {
	buf.WriteString(name)

	if labels != "" {
		buf.WriteByte('{')
		buf.WriteString(labels)
		buf.WriteByte('}')
	}

	buf.WriteByte(' ')
	buf.WriteString(strconv.FormatInt(value, 10))
	buf.WriteByte('\n')
}

func escapeLabelValue(value string) string {
	return strings.NewReplacer(`\`, `\\`, `"`, `\"`, "\n", `\n`).Replace(value)
}

// histogram — минимальная гистограмма с фиксированными кумулятивными корзинами.
type histogram struct {
	buckets []float64

	mu     sync.Mutex
	counts []uint64
	sum    float64
	total  uint64
}

func newHistogram(buckets []float64) *histogram {
	return &histogram{
		buckets: buckets,
		counts:  make([]uint64, len(buckets)),
	}
}

func (h *histogram) observe(value float64) {
	if value < 0 {
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	h.sum += value
	h.total++

	for i, bound := range h.buckets {
		if value <= bound {
			h.counts[i]++
		}
	}
}

func (h *histogram) write(buf *strings.Builder, name, help, labels string) {
	h.mu.Lock()
	counts := make([]uint64, len(h.counts))
	copy(counts, h.counts)
	sum := h.sum
	total := h.total
	h.mu.Unlock()

	fmt.Fprintf(buf, "# HELP %s %s\n# TYPE %s histogram\n", name, help, name)

	for i, bound := range h.buckets {
		fmt.Fprintf(buf, "%s_bucket{%s,le=\"%s\"} %d\n",
			name, labels, strconv.FormatFloat(bound, 'g', -1, 64), counts[i])
	}

	fmt.Fprintf(buf, "%s_bucket{%s,le=\"+Inf\"} %d\n", name, labels, total)
	fmt.Fprintf(buf, "%s_sum{%s} %s\n", name, labels, strconv.FormatFloat(sum, 'g', -1, 64))
	fmt.Fprintf(buf, "%s_count{%s} %d\n", name, labels, total)
}
