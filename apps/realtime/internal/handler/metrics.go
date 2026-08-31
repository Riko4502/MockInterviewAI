package handler

import (
	"net/http"

	"github.com/mockinterviewai/realtime/internal/sse"
)

// MetricsHandler экспортирует метрики SSE-подсистемы в текстовом формате Prometheus.
//
// Эндпоинт предназначен для внутреннего скрейпинга и не должен публиковаться
// наружу через балансировщик: он раскрывает число активных пользователей ноды.
// Метрики WebSocket-подсистемы будут добавлены сюда отдельной задачей (ROADMAP 3.3).
type MetricsHandler struct {
	sseHub *sse.Hub
}

// NewMetricsHandler создает обработчик экспорта метрик.
func NewMetricsHandler(sseHub *sse.Hub) *MetricsHandler {
	return &MetricsHandler{sseHub: sseHub}
}

// ServeHTTP обрабатывает запрос GET /metrics.
func (h *MetricsHandler) ServeHTTP(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)

	if h.sseHub != nil {
		h.sseHub.Metrics().WritePrometheus(w)
	}
}
