package handler

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mockinterviewai/realtime/internal/ws"
)

func TestHealthEndpoints(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	hub := ws.NewHub(ctx, nil, logger)
	healthHandler := NewHealthHandler(hub, nil)

	// 1. Тест /healthz (liveness)
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()

	healthHandler.Healthz(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	var healthResp HealthResponse
	if err := json.NewDecoder(rec.Body).Decode(&healthResp); err != nil {
		t.Fatalf("failed to decode health response: %v", err)
	}

	if healthResp.Status != "ok" || healthResp.Service != "realtime" {
		t.Errorf("unexpected health response: %+v", healthResp)
	}

	// 2. Тест /readyz (readiness)
	reqReady := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	recReady := httptest.NewRecorder()

	healthHandler.Readyz(recReady, reqReady)

	if recReady.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", recReady.Code)
	}

	var readyResp ReadyResponse
	if err := json.NewDecoder(recReady.Body).Decode(&readyResp); err != nil {
		t.Fatalf("failed to decode ready response: %v", err)
	}

	if readyResp.Status != "ready" || readyResp.TotalRooms != 0 || readyResp.TotalClients != 0 {
		t.Errorf("unexpected ready response: %+v", readyResp)
	}
}
