package config

import (
	"os"
	"testing"
)

func TestConfigProductionValidation(t *testing.T) {
	// 1. В продакшене без ALLOWED_ORIGINS должна быть ошибка (защита от CSWSH)
	os.Setenv("ENV", "production")
	os.Setenv("JWT_SECRET", "super-secret-key-12345")
	os.Setenv("ALLOWED_ORIGINS", "*")
	defer func() {
		os.Unsetenv("ENV")
		os.Unsetenv("JWT_SECRET")
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
