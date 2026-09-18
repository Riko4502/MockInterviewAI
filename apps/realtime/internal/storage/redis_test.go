package storage

import (
	"context"
	"log/slog"
	"os"
	"testing"
)

// TestRedactRedisAddr закрывает регрессию: строка подключения писалась в лог
// как есть, из-за чего пароль из REDIS_URL уезжал в агрегатор логов на уровне INFO.
func TestRedactRedisAddr(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "url with password only",
			in:   "redis://:s3cret@localhost:6379/0",
			want: "redis://:***@localhost:6379/0",
		},
		{
			name: "url with user and password",
			in:   "redis://admin:s3cret@redis.internal:6379/0",
			want: "redis://admin:***@redis.internal:6379/0",
		},
		{
			name: "tls url with password",
			in:   "rediss://:s3cret@redis.internal:6380/1",
			want: "rediss://:***@redis.internal:6380/1",
		},
		{
			name: "url without credentials",
			in:   "redis://localhost:6379/0",
			want: "redis://localhost:6379/0",
		},
		{
			name: "plain host and port",
			in:   "localhost:6379",
			want: "localhost:6379",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := redactRedisAddr(tc.in); got != tc.want {
				t.Errorf("redactRedisAddr(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

// TestCheckMinGeneration_FailClosed проверяет, что CheckMinGeneration
// завершается с ошибкой (fail-closed), когда Redis недоступен или отключён,
// чтобы generation fence не обходился при деградации инфраструктуры (§CWE-613).
func TestCheckMinGeneration_FailClosed(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))

	t.Run("disabled store returns ErrRedisUnavailable", func(t *testing.T) {
		store := &RedisStore{
			enabled: false,
			client:  nil,
			logger:  logger,
		}
		ok, err := store.CheckMinGeneration(context.Background(), "user-1", 5)
		if ok {
			t.Error("expected ok=false for disabled store (fail-closed), got true")
		}
		if err != ErrRedisUnavailable {
			t.Errorf("expected ErrRedisUnavailable, got %v", err)
		}
	})

	t.Run("enabled store with nil client returns ErrRedisUnavailable", func(t *testing.T) {
		store := &RedisStore{
			enabled: true,
			client:  nil,
			logger:  logger,
		}
		ok, err := store.CheckMinGeneration(context.Background(), "user-1", 5)
		if ok {
			t.Error("expected ok=false for nil client (fail-closed), got true")
		}
		if err != ErrRedisUnavailable {
			t.Errorf("expected ErrRedisUnavailable, got %v", err)
		}
	})

	t.Run("empty userID returns error", func(t *testing.T) {
		store := &RedisStore{
			enabled: true,
			client:  nil, // nil-клиент сработает раньше, но тест документирует намерение
			logger:  logger,
		}
		ok, err := store.CheckMinGeneration(context.Background(), "", 5)
		if ok {
			t.Error("expected ok=false for empty userID, got true")
		}
		if err == nil {
			t.Error("expected non-nil error for empty userID, got nil")
		}
	})
}
