package handler

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/mockinterviewai/realtime/internal/sse"
	"github.com/mockinterviewai/realtime/internal/ws"
)

func TestHealthEndpoints(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	hub := ws.NewHub(ctx, nil, nil, logger)
	sseHub := sse.NewHub(ctx, nil, nil, sse.Options{}, "test-node", logger)
	defer func() { _ = sseHub.Close() }()

	healthHandler := NewHealthHandler(hub, sseHub, nil)

	// 1. Тест /healthz (liveness)
	req := httptest.NewRequest(http.MethodGet, "/healthz", http.NoBody)
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
	reqReady := httptest.NewRequest(http.MethodGet, "/readyz", http.NoBody)
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

// unhealthyStore реализует storage.SessionStore с недоступным Redis.
type unhealthyStore struct{ fakeStore }

func (u *unhealthyStore) Ping(context.Context) error {
	return errors.New("NOAUTH Authentication required.")
}

// TestReadyzReportsUnavailableWhenRedisIsDown закрывает регрессию readiness:
// раньше при мертвом Redis эндпоинт отвечал 200 со "status":"ready", и проба
// оркестратора оставляла неработающий инстанс в ротации.
func TestReadyzReportsUnavailableWhenRedisIsDown(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	hub := ws.NewHub(ctx, nil, nil, logger)
	sseHub := sse.NewHub(ctx, nil, nil, sse.Options{}, "test-node", logger)
	defer func() { _ = sseHub.Close() }()

	healthHandler := NewHealthHandler(hub, sseHub, &unhealthyStore{})

	rec := httptest.NewRecorder()
	healthHandler.Readyz(rec, httptest.NewRequest(http.MethodGet, "/readyz", http.NoBody))

	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503 when redis is unreachable, got %d", rec.Code)
	}

	var resp ReadyResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode ready response: %v", err)
	}

	if resp.Status != "degraded" {
		t.Errorf("expected status \"degraded\", got %q", resp.Status)
	}

	if !strings.Contains(resp.Redis, "NOAUTH") {
		t.Errorf("redis diagnostics must be preserved, got %q", resp.Redis)
	}
}

// TestReadyzStaysReadyWhenRedisIsDisabled фиксирует, что осознанно выключенный
// Redis (REDIS_ENABLED=false) готовность ноды не отменяет: Ping в этом режиме
// не выполняется и ошибку не возвращает.
func TestReadyzStaysReadyWhenRedisIsDisabled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	hub := ws.NewHub(ctx, nil, nil, logger)
	sseHub := sse.NewHub(ctx, nil, nil, sse.Options{}, "test-node", logger)
	defer func() { _ = sseHub.Close() }()

	healthHandler := NewHealthHandler(hub, sseHub, &fakeStore{})

	rec := httptest.NewRecorder()
	healthHandler.Readyz(rec, httptest.NewRequest(http.MethodGet, "/readyz", http.NoBody))

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 with a healthy store, got %d", rec.Code)
	}
}

// TestMetricsEndpointRejectsExternalPeers закрывает регрессию: /metrics
// раскрывает число активных пользователей ноды и не должен отвечать наружу.
func TestMetricsEndpointRejectsExternalPeers(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	sseHub := sse.NewHub(ctx, nil, nil, sse.Options{}, "test-node", logger)
	defer func() { _ = sseHub.Close() }()

	cases := []struct {
		name        string
		remoteAddr  string
		allowPublic bool
		wantCode    int
	}{
		{name: "loopback", remoteAddr: "127.0.0.1:54321", wantCode: http.StatusOK},
		{name: "docker network", remoteAddr: "172.17.0.5:54321", wantCode: http.StatusOK},
		{name: "kubernetes pod", remoteAddr: "10.42.0.7:54321", wantCode: http.StatusOK},
		{name: "ipv6 loopback", remoteAddr: "[::1]:54321", wantCode: http.StatusOK},
		{name: "public peer", remoteAddr: "203.0.113.10:54321", wantCode: http.StatusNotFound},
		{name: "public peer with override", remoteAddr: "203.0.113.10:54321", allowPublic: true, wantCode: http.StatusOK},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			metricsHandler := NewMetricsHandler(sseHub, logger, tc.allowPublic)

			req := httptest.NewRequest(http.MethodGet, "/metrics", http.NoBody)
			req.RemoteAddr = tc.remoteAddr

			rec := httptest.NewRecorder()
			metricsHandler.ServeHTTP(rec, req)

			if rec.Code != tc.wantCode {
				t.Errorf("expected %d, got %d", tc.wantCode, rec.Code)
			}
		})
	}
}

// TestMetricsEndpointIgnoresProxyHeaders фиксирует, что ограничение нельзя
// обойти подделкой X-Forwarded-For: учитывается только реальный TCP-пир.
func TestMetricsEndpointIgnoresProxyHeaders(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	sseHub := sse.NewHub(ctx, nil, nil, sse.Options{}, "test-node", logger)
	defer func() { _ = sseHub.Close() }()

	req := httptest.NewRequest(http.MethodGet, "/metrics", http.NoBody)
	req.RemoteAddr = "203.0.113.10:54321"
	req.Header.Set("X-Forwarded-For", "127.0.0.1")

	rec := httptest.NewRecorder()
	NewMetricsHandler(sseHub, logger, false).ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("spoofed X-Forwarded-For must not grant access, got %d", rec.Code)
	}
}
