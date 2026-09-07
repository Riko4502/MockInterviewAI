package config

import (
	"os"
	"testing"
)

func TestConfigProductionValidation(t *testing.T) {
	// 1. В продакшене без ALLOWED_ORIGINS должна быть ошибка (защита от CSWSH)
	os.Setenv("ENV", "production")
	os.Setenv("JWT_ACCESS_SECRET", "super-secret-key-12345")
	os.Setenv("LIVEKIT_WEBHOOK_API_SECRET", "super-webhook-secret")
	os.Setenv("ALLOWED_ORIGINS", "*")
	defer func() {
		os.Unsetenv("ENV")
		os.Unsetenv("JWT_ACCESS_SECRET")
		os.Unsetenv("LIVEKIT_WEBHOOK_API_SECRET")
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

func TestConfigProductionViaEnvironmentFallback(t *testing.T) {
	// По умолчанию (без ENV/ENVIRONMENT) — development, секреты получают dev-дефолты.
	os.Unsetenv("ENV")
	os.Unsetenv("ENVIRONMENT")
	devCfg, err := Load()
	if err != nil {
		t.Fatalf("expected valid dev config, got error: %v", err)
	}
	if devCfg.LiveKitWebhookAPISecret != "dev-local-secret-change-me-0123456789" {
		t.Errorf("expected dev webhook secret fallback, got %q", devCfg.LiveKitWebhookAPISecret)
	}

	// Prod-контейнер задаёт только ENVIRONMENT=production — fail-closed включается.
	os.Setenv("ENVIRONMENT", "production")
	os.Setenv("JWT_ACCESS_SECRET", "prod-access-secret")
	os.Setenv("ALLOWED_ORIGINS", "https://app.mockinterview.ai")
	// Fail-closed проверяется на отсутствие секрета — принудительно пустое значение,
	// чтобы корневой .env (который Load() подгружает сам) не дал секрет.
	os.Setenv("LIVEKIT_WEBHOOK_API_SECRET", "")
	defer func() {
		os.Unsetenv("ENVIRONMENT")
		os.Unsetenv("JWT_ACCESS_SECRET")
		os.Unsetenv("ALLOWED_ORIGINS")
		os.Unsetenv("LIVEKIT_WEBHOOK_API_SECRET")
	}()

	_, err = Load()
	if err == nil {
		t.Error("expected error when ENVIRONMENT=production but webhook secret missing, got nil")
	}

	os.Setenv("LIVEKIT_WEBHOOK_API_SECRET", "prod-webhook-secret")
	defer os.Unsetenv("LIVEKIT_WEBHOOK_API_SECRET")
	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected valid prod config with secret, got error: %v", err)
	}
	if cfg.LiveKitWebhookAPISecret != "prod-webhook-secret" {
		t.Errorf("expected configured webhook secret, got %q", cfg.LiveKitWebhookAPISecret)
	}
}
