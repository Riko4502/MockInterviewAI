package handler

import (
	"log/slog"
	"net"
	"net/http"

	"github.com/mockinterviewai/realtime/internal/sse"
)

// MetricsHandler экспортирует метрики SSE-подсистемы в текстовом формате Prometheus.
//
// Эндпоинт раскрывает число активных пользователей ноды, поэтому по умолчанию
// обслуживаются только запросы из петлевых и частных сетей (localhost, сеть
// Docker, кластерная подсеть Kubernetes). Публичный доступ включается явно
// переменной METRICS_ALLOW_PUBLIC — на случай, когда эндпоинт закрыт
// аутентификацией на уровне обратного прокси.
//
// Метрики WebSocket-подсистемы будут добавлены сюда отдельной задачей (ROADMAP 3.3).
type MetricsHandler struct {
	sseHub      *sse.Hub
	logger      *slog.Logger
	allowPublic bool
}

// NewMetricsHandler создает обработчик экспорта метрик.
func NewMetricsHandler(sseHub *sse.Hub, logger *slog.Logger, allowPublic bool) *MetricsHandler {
	return &MetricsHandler{
		sseHub:      sseHub,
		logger:      logger.With(slog.String("component", "metrics_handler")),
		allowPublic: allowPublic,
	}
}

// ServeHTTP обрабатывает запрос GET /metrics.
func (h *MetricsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !h.allowPublic && !isInternalPeer(r.RemoteAddr) {
		h.logger.Warn("rejected external request to the metrics endpoint",
			slog.String("remoteAddr", r.RemoteAddr),
		)
		// 404 вместо 403: посторонним незачем подтверждать наличие эндпоинта.
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)

	if h.sseHub != nil {
		h.sseHub.Metrics().WritePrometheus(w)
	}
}

// isInternalPeer проверяет, что скрейпер пришел из петлевой или частной сети.
//
// Адрес берется только из RemoteAddr — реального TCP-пира. Заголовки прокси
// здесь принципиально не учитываются: их подделка снимала бы ограничение,
// а метрики и не должны публиковаться через обратный прокси.
func isInternalPeer(remoteAddr string) bool {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}

	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}

	return ip.IsLoopback() ||
		ip.IsPrivate() ||
		ip.IsLinkLocalUnicast() ||
		ip.IsUnspecified()
}
