package sse

import (
	"bytes"
	"strings"
	"testing"
)

// TestMetricsExposeStreamBacklogAndPollBatch проверяет, что counter суммарного
// избытка догоняющих событий и гистограмма размеров поллингов попадают
// в текстовую экспозицию Prometheus.
func TestMetricsExposeStreamBacklogAndPollBatch(t *testing.T) {
	m := NewMetrics("node-1")

	m.ObservePollBatch(3)
	m.ObservePollBatch(1)
	m.ObservePollBatch(0) // пустая пачка — игнорируется

	if got := m.StreamBacklogEntriesTotal(); got != 2 {
		t.Fatalf("StreamBacklogEntriesTotal() = %d, want 2", got)
	}

	var buf bytes.Buffer
	m.WritePrometheus(&buf)
	out := buf.String()

	for _, want := range []string{
		"# HELP realtime_sse_stream_backlog_entries_total",
		"# TYPE realtime_sse_stream_backlog_entries_total counter",
		"realtime_sse_stream_backlog_entries_total{node_id=\"node-1\"} 2",
		"# TYPE realtime_sse_poll_batch_entries histogram",
		`realtime_sse_poll_batch_entries_count{node_id="node-1"} 2`,
		`realtime_sse_poll_batch_entries_bucket{node_id="node-1",le="+Inf"} 2`,
	} {
		if !strings.Contains(out, want) {
			t.Errorf("expected metric output to contain %q, got:\n%s", want, out)
		}
	}
}
