package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/mockinterviewai/realtime/internal/sse"
	"github.com/mockinterviewai/realtime/internal/storage"
	"github.com/mockinterviewai/realtime/internal/ws"
)

// HealthResponse содержит строго типизированный ответ о здоровье сервиса.
type HealthResponse struct {
	Status    string    `json:"status"`
	Service   string    `json:"service"`
	Timestamp time.Time `json:"timestamp"`
}

// ReadyResponse содержит статус готовности и текущие метрики соединений.
type ReadyResponse struct {
	Status       string    `json:"status"`
	Service      string    `json:"service"`
	Redis        string    `json:"redis,omitempty"`
	TotalRooms   int       `json:"totalRooms"`
	TotalClients int       `json:"totalClients"`
	SSEClients   int       `json:"sseClients"`
	SSEUsers     int       `json:"sseUsers"`
	Timestamp    time.Time `json:"timestamp"`
}

// HealthHandler обрабатывает проверки жизнеспособности (liveness probe).
type HealthHandler struct {
	hub          *ws.Hub
	sseHub       *sse.Hub
	sessionStore storage.SessionStore
}

// NewHealthHandler создает новый экземпляр HealthHandler.
func NewHealthHandler(hub *ws.Hub, sseHub *sse.Hub, sessionStore storage.SessionStore) *HealthHandler {
	return &HealthHandler{
		hub:          hub,
		sseHub:       sseHub,
		sessionStore: sessionStore,
	}
}

// Healthz обрабатывает запрос liveness /healthz.
func (h *HealthHandler) Healthz(w http.ResponseWriter, _ *http.Request) {
	resp := HealthResponse{
		Status:    "ok",
		Service:   "realtime",
		Timestamp: time.Now().UTC(),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(resp)
}

// Readyz обрабатывает запрос readiness /readyz с проверкой Redis.
//
// При недоступном Redis нода не может ни доставлять уведомления, ни вычитывать
// персональные стримы, поэтому ответ отдается кодом 503: иначе readiness-проба
// оркестратора засчитывает такой инстанс исправным и оставляет его в ротации.
// Осознанно выключенный Redis (REDIS_ENABLED=false) готовности не отменяет —
// Ping в этом режиме не выполняется и ошибки не возвращает.
func (h *HealthHandler) Readyz(w http.ResponseWriter, r *http.Request) {
	redisStatus := "ok"
	ready := true

	if h.sessionStore != nil {
		if err := h.sessionStore.Ping(r.Context()); err != nil {
			redisStatus = "degraded: " + err.Error()
			ready = false
		}
	}

	var sseClients, sseUsers int
	if h.sseHub != nil {
		sseClients, sseUsers = h.sseHub.Stats()
	}

	status := "ready"
	httpStatus := http.StatusOK

	if !ready {
		status = "degraded"
		httpStatus = http.StatusServiceUnavailable
	}

	resp := ReadyResponse{
		Status:       status,
		Service:      "realtime",
		Redis:        redisStatus,
		TotalRooms:   h.hub.TotalRooms(),
		TotalClients: h.hub.TotalClients(),
		SSEClients:   sseClients,
		SSEUsers:     sseUsers,
		Timestamp:    time.Now().UTC(),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpStatus)
	_ = json.NewEncoder(w).Encode(resp)
}
