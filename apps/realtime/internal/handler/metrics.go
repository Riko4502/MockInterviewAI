package handler

import (
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strings"

	"github.com/mockinterviewai/realtime/internal/sse"
	"github.com/mockinterviewai/realtime/internal/storage"
	"github.com/mockinterviewai/realtime/internal/ws"
)

// wsMetricsProvider — источник метрик WebSocket-подсистемы (/ws).
type wsMetricsProvider interface {
	Metrics() *ws.Metrics
}

// redisPoolStatsProvider — источник статистики пула соединений Redis.
type redisPoolStatsProvider interface {
	PoolStats() *storage.RedisPoolStats
}

// MetricsHandler экспортирует метрики SSE-, WebSocket-подсистем и пула Redis
// в текстовом формате Prometheus.
//
// Эндпоинт раскрывает число активных пользователей ноды, поэтому по умолчанию
// обслуживаются только запросы из петлевых и частных сетей (localhost, сеть
// Docker, кластерная подсеть Kubernetes). Публичный доступ включается явно
// переменной METRICS_ALLOW_PUBLIC — на случай, когда эндпоинт закрыт
// аутентификацией на уровне обратного прокси.
type MetricsHandler struct {
	sseHub      *sse.Hub
	wsHub       wsMetricsProvider
	redisPool   redisPoolStatsProvider
	nodeID      string
	logger      *slog.Logger
	allowPublic bool
}

// NewMetricsHandler создает обработчик экспорта метрик.
func NewMetricsHandler(
	sseHub *sse.Hub,
	wsHub wsMetricsProvider,
	redisPool redisPoolStatsProvider,
	nodeID string,
	logger *slog.Logger,
	allowPublic bool,
) *MetricsHandler {
	return &MetricsHandler{
		sseHub:      sseHub,
		wsHub:       wsHub,
		redisPool:   redisPool,
		nodeID:      nodeID,
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

	var buf strings.Builder

	if h.sseHub != nil {
		h.sseHub.Metrics().WritePrometheus(&buf)
	}

	if h.wsHub != nil && h.wsHub.Metrics() != nil {
		h.wsHub.Metrics().WritePrometheus(&buf)
	}

	h.writeRedisPool(&buf)

	_, _ = w.Write([]byte(buf.String()))
}

// writeRedisPool выводит снимок пула соединений Redis (PLAN шаг 8).
// В disabled-режиме (нет клиента) метрики просто не экспортируются.
func (h *MetricsHandler) writeRedisPool(buf *strings.Builder) {
	if h.redisPool == nil {
		return
	}

	stats := h.redisPool.PoolStats()
	if stats == nil {
		return
	}

	node := escapeLabelValue(h.nodeID)
	labels := `node_id="` + node + `"`

	writeGauge(buf, "redis_pool_total", "Number of connections in the Redis pool", labels, int64(stats.TotalConns))
	writeGauge(buf, "redis_pool_idle", "Number of idle connections in the Redis pool", labels, int64(stats.IdleConns))
	writeGauge(buf, "redis_pool_stale", "Number of stale connections removed from the Redis pool", labels, int64(stats.StaleConns))

	writeCounter(buf, "redis_pool_hits_total", "Total number of pool hits (free conn found)", labels, stats.Hits)
	writeCounter(buf, "redis_pool_misses_total", "Total number of pool misses (new conn dialed)", labels, stats.Misses)
	writeCounter(buf, "redis_pool_timeouts_total", "Total number of pool wait timeouts", labels, stats.Timeouts)
}

// writeGauge выводит метрику-измеритель с HELP/TYPE-комментариями.
func writeGauge(buf *strings.Builder, name, help, labels string, value int64) {
	fmt.Fprintf(buf, "# HELP %s %s\n# TYPE %s gauge\n", name, help, name)
	writeSample(buf, name, labels, value)
}

// writeCounter выводит метрику-счетчик с HELP/TYPE-комментариями.
func writeCounter(buf *strings.Builder, name, help, labels string, value int64) {
	fmt.Fprintf(buf, "# HELP %s %s\n# TYPE %s counter\n", name, help, name)
	writeSample(buf, name, labels, value)
}

// writeSample выводит строку "name{labels} value" без HELP/TYPE.
func writeSample(buf *strings.Builder, name, labels string, value int64) {
	buf.WriteString(name)
	if labels != "" {
		buf.WriteByte('{')
		buf.WriteString(labels)
		buf.WriteByte('}')
	}
	fmt.Fprintf(buf, " %d\n", value)
}

func escapeLabelValue(value string) string {
	return strings.NewReplacer(`\`, `\\`, `"`, `\"`, "\n", `\n`).Replace(value)
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
