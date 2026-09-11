package ws

import (
	"bytes"
	"strings"
	"testing"
)

// TestMetricsExposeWebSocketMetrics проверяет текстовую экспозицию метрик
// WebSocket-подсистемы: помощь, тип и лейбл node_id должны попадать в вывод.
func TestMetricsExposeWebSocketMetrics(t *testing.T) {
	m := NewMetrics("node-1")

	// Под допустимым порогом — промахи тоже формируют гистограмму.
	m.ObservePubSubLag(0.0)
	m.ObservePubSubLag(0.005)

	var buf bytes.Buffer
	m.WritePrometheus(&buf)
	out := buf.String()

	for _, want := range []string{
		"# HELP realtime_ws_pubsub_lag_seconds",
		"# TYPE realtime_ws_pubsub_lag_seconds histogram",
		`node_id="node-1"`,
		"realtime_ws_pubsub_lag_seconds_sum",
		`realtime_ws_pubsub_lag_seconds_count{node_id="node-1"} 2`,
		`realtime_ws_pubsub_lag_seconds_bucket{node_id="node-1",le="+Inf"} 2`,
	} {
		if !strings.Contains(out, want) {
			t.Errorf("expected metric output to contain %q, got:\n%s", want, out)
		}
	}

	if m.NodeID() != "node-1" {
		t.Errorf("NodeID() = %q, want %q", m.NodeID(), "node-1")
	}
}

func TestServiceNodeIDIsUnknownByDefault(t *testing.T) {
	m := NewMetrics("")
	if m.NodeID() != "unknown" {
		t.Errorf("NodeID() = %q, want %q", m.NodeID(), "unknown")
	}
}
