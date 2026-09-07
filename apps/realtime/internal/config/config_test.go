package config

import (
	"os"
	"testing"
	"time"
)

func TestConfigProductionValidation(t *testing.T) {
	// 1. В продакшене без ALLOWED_ORIGINS должна быть ошибка (защита от CSWSH)
	os.Setenv("ENV", "production")
	os.Setenv("JWT_ACCESS_SECRET", "super-secret-key-12345")
	os.Setenv("ALLOWED_ORIGINS", "*")
	defer func() {
		os.Unsetenv("ENV")
		os.Unsetenv("JWT_ACCESS_SECRET")
		os.Unsetenv("ALLOWED_ORIGINS")
	}()

	_, err := Load()
	if err == nil {
		t.Error("expected error when ALLOWED_ORIGINS=* in production, got nil")
	}

	// 2. В продакшене с конкретными доменами конфиг должен успешно загружаться
	os.Setenv("ALLOWED_ORIGINS", "https://mockinterview.ai,https://app.mockinterview.ai")
	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected valid config in production, got error: %v", err)
	}

	if len(cfg.AllowedOrigins) != 2 || cfg.AllowedOrigins[0] != "https://mockinterview.ai" {
		t.Errorf("unexpected allowed origins: %+v", cfg.AllowedOrigins)
	}
}

func TestSSEDefaultsAndOverrides(t *testing.T) {
	// 1. Значения по умолчанию соответствуют SSE_SPEC.md
	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected valid config, got error: %v", err)
	}

	if cfg.SSEHeartbeatInterval != 15*time.Second {
		t.Errorf("expected default heartbeat of 15s, got %v", cfg.SSEHeartbeatInterval)
	}

	if cfg.SSERetryMs != 3000 {
		t.Errorf("expected default retry of 3000ms, got %d", cfg.SSERetryMs)
	}

	if cfg.SSEClientBufferSize != 128 {
		t.Errorf("expected default client buffer of 128, got %d", cfg.SSEClientBufferSize)
	}

	if cfg.SSEMaxConnectionsPerUser != 5 || cfg.SSEMaxConnectionsPerIP != 20 {
		t.Errorf("unexpected default sse connection limits: %d per user, %d per ip",
			cfg.SSEMaxConnectionsPerUser, cfg.SSEMaxConnectionsPerIP)
	}

	if cfg.TrustProxyHeaders {
		t.Error("proxy headers must not be trusted by default")
	}

	// 2. Переопределение через переменные окружения
	os.Setenv("SSE_HEARTBEAT_SECONDS", "5")
	os.Setenv("SSE_MAX_CONNECTIONS_PER_USER", "3")
	os.Setenv("TRUST_PROXY_HEADERS", "true")
	defer func() {
		os.Unsetenv("SSE_HEARTBEAT_SECONDS")
		os.Unsetenv("SSE_MAX_CONNECTIONS_PER_USER")
		os.Unsetenv("TRUST_PROXY_HEADERS")
	}()

	cfg, err = Load()
	if err != nil {
		t.Fatalf("expected valid config, got error: %v", err)
	}

	if cfg.SSEHeartbeatInterval != 5*time.Second {
		t.Errorf("expected overridden heartbeat of 5s, got %v", cfg.SSEHeartbeatInterval)
	}

	if cfg.SSEMaxConnectionsPerUser != 3 {
		t.Errorf("expected overridden per-user limit of 3, got %d", cfg.SSEMaxConnectionsPerUser)
	}

	if !cfg.TrustProxyHeaders {
		t.Error("expected proxy headers to be trusted after override")
	}

	// 3. Некорректное значение должно приводить к ошибке загрузки конфигурации
	os.Setenv("SSE_RETRY_MS", "not-a-number")
	defer os.Unsetenv("SSE_RETRY_MS")

	if _, err := Load(); err == nil {
		t.Error("expected error for a malformed SSE_RETRY_MS, got nil")
	}
}
