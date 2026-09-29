package handler

import (
	"context"
	"net/http"
	"time"
)

// pinger — проверка доступности Judge0 для readiness-пробы.
type pinger interface {
	Ping(ctx context.Context) error
}

// HealthResponse — ответ liveness-пробы.
type HealthResponse struct {
	Status    string    `json:"status"`
	Service   string    `json:"service"`
	Timestamp time.Time `json:"timestamp"`
}

// ReadyResponse — ответ readiness-пробы с состоянием Judge0.
type ReadyResponse struct {
	Status    string    `json:"status"`
	Service   string    `json:"service"`
	Judge0    string    `json:"judge0"`
	Timestamp time.Time `json:"timestamp"`
}

// HealthHandler обслуживает пробы жизнеспособности и готовности.
type HealthHandler struct {
	judge       pinger
	pingTimeout time.Duration
}

// NewHealthHandler создаёт обработчик проб.
func NewHealthHandler(judge pinger, pingTimeout time.Duration) *HealthHandler {
	return &HealthHandler{judge: judge, pingTimeout: pingTimeout}
}

// Healthz — liveness: процесс жив и обслуживает HTTP.
func (h *HealthHandler) Healthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, HealthResponse{
		Status:    "ok",
		Service:   "code-runner",
		Timestamp: time.Now().UTC(),
	})
}

// Readyz — readiness: без доступного Judge0 сервис не может выполнить ни
// одного запроса, поэтому отвечает 503 и выводится из ротации балансировщика.
func (h *HealthHandler) Readyz(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), h.pingTimeout)
	defer cancel()

	resp := ReadyResponse{
		Status:    "ready",
		Service:   "code-runner",
		Judge0:    "ok",
		Timestamp: time.Now().UTC(),
	}

	status := http.StatusOK

	if err := h.judge.Ping(ctx); err != nil {
		resp.Status = "degraded"
		resp.Judge0 = "unavailable"
		status = http.StatusServiceUnavailable
	}

	writeJSON(w, status, resp)
}
