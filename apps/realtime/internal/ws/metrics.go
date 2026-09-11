package ws

import (
	"fmt"
	"io"
	"strconv"
	"strings"
	"sync"
)

// pubsubLagBuckets — границы гистограммы задержки релея событий комнат через
// Redis Pub/Sub в секундах. Типичные значения — единицы миллисекунд.
var pubsubLagBuckets = []float64{0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1}

// Metrics агрегирует SRE-метрики WebSocket-подсистемы (PLAN шаг 9).
//
// Счетчики реализованы без клиентской библиотеки Prometheus: экспорт выполняется
// напрямую в текстовом формате экспозиции, как и в sse-подсистеме.
type Metrics struct {
	nodeID string

	pubsubLag *histogram
}

// NewMetrics создает набор метрик, помеченных идентификатором текущей ноды.
func NewMetrics(nodeID string) *Metrics {
	if nodeID == "" {
		nodeID = "unknown"
	}

	return &Metrics{
		nodeID:    nodeID,
		pubsubLag: newHistogram(pubsubLagBuckets),
	}
}

// ObservePubSubLag фиксирует задержку между публикацией события в Redis Pub/Sub
// и его получением другой репликой ноды.
func (m *Metrics) ObservePubSubLag(seconds float64) {
	m.pubsubLag.observe(seconds)
}

// NodeID возвращает идентификатор ноды, под которым экспортируются метрики.
func (m *Metrics) NodeID() string {
	return m.nodeID
}

// WritePrometheus выводит все метрики WebSocket в текстовом формате экспозиции Prometheus.
func (m *Metrics) WritePrometheus(w io.Writer) {
	node := escapeLabelValue(m.nodeID)
	var buf strings.Builder

	m.pubsubLag.write(&buf, "realtime_ws_pubsub_lag_seconds",
		"Delay of room event relay through Redis Pub/Sub between replicas",
		`node_id="`+node+`"`)

	_, _ = io.WriteString(w, buf.String())
}

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

func escapeLabelValue(value string) string {
	return strings.NewReplacer(`\`, `\\`, `"`, `\"`, "\n", `\n`).Replace(value)
}
