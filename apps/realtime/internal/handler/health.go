package handler

import (
	"encoding/json"
	"net/http"
	"time"

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
	Timestamp    time.Time `json:"timestamp"`
}

// HealthHandler обрабатывает проверки жизнеспособности (liveness probe).
type HealthHandler struct {
	hub          *ws.Hub
	sessionStore storage.SessionStore
}

// NewHealthHandler создает новый экземпляр HealthHandler.
func NewHealthHandler(hub *ws.Hub, sessionStore storage.SessionStore) *HealthHandler {
	return &HealthHandler{
		hub:          hub,
		sessionStore: sessionStore,
	}
}

// Healthz обрабатывает запрос liveness /healthz.
func (h *HealthHandler) Healthz(w http.ResponseWriter, r *http.Request) {
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
func (h *HealthHandler) Readyz(w http.ResponseWriter, r *http.Request) {
	redisStatus := "ok"
	if h.sessionStore != nil {
		if err := h.sessionStore.Ping(r.Context()); err != nil {
			redisStatus = "degraded: " + err.Error()
		}
	}

	resp := ReadyResponse{
		Status:       "ready",
		Service:      "realtime",
		Redis:        redisStatus,
		TotalRooms:   h.hub.TotalRooms(),
		TotalClients: h.hub.TotalClients(),
		Timestamp:    time.Now().UTC(),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(resp)
}
