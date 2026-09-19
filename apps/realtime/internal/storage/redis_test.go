package storage

import (
	"context"
	"io"
	"log/slog"
	"testing"

	"github.com/mockinterviewai/realtime/internal/config"
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

func TestRedisStore_Disabled_FailClosed(t *testing.T) {
	cfg := &config.Config{
		RedisEnabled: false,
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	store := NewRedisStore(cfg, logger)
	ctx := context.Background()

	// 1. IsSessionActive must return false when Redis is disabled
	active, err := store.IsSessionActive(ctx, "any-session-id")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if active {
		t.Errorf("IsSessionActive should return false when Redis is disabled (fail-closed)")
	}

	// 2. GetSessionUserRole must return empty string when Redis is disabled
	role, err := store.GetSessionUserRole(ctx, "any-session-id", "any-user-id")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if role != "" {
		t.Errorf("GetSessionUserRole should return empty string when Redis is disabled (fail-closed), got %q", role)
	}

	// 3. IsAuthSessionActive must return false when Redis is disabled
	authActive, err := store.IsAuthSessionActive(ctx, "any-sid")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if authActive {
		t.Errorf("IsAuthSessionActive should return false when Redis is disabled (fail-closed)")
	}

	// 4. ConsumeTicket must return false when Redis is disabled
	consumed, err := store.ConsumeTicket(ctx, "ticket-id")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if consumed {
		t.Error("ConsumeTicket should return false when Redis is disabled")
	}
}

