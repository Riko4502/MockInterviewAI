package storage

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/mockinterviewai/realtime/internal/config"
	redis "github.com/redis/go-redis/v9"
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
		rdb := redis.NewClient(&redis.Options{
			Addr: "127.0.0.1:0",
		})
		defer rdb.Close()

		store := &RedisStore{
			enabled: true,
			client:  rdb,
			logger:  logger,
		}
		ok, err := store.CheckMinGeneration(context.Background(), "", 5)
		if ok {
			t.Error("expected ok=false for empty userID, got true")
		}
		if err == nil {
			t.Fatal("expected non-nil error for empty userID, got nil")
		}
		if errors.Is(err, ErrRedisUnavailable) {
			t.Errorf("expected validation error for empty userID, got ErrRedisUnavailable: %v", err)
		}
	})
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

// TestPoolStatsDisabledReturnsNil закрывает регрессию: без клиента Redis
// (disabled-режим) пула не существует, и метрики экспортируются без него.
func TestPoolStatsDisabledReturnsNil(t *testing.T) {
	store := &RedisStore{}
	if ps := store.PoolStats(); ps != nil {
		t.Errorf("PoolStats on disabled store must be nil, got %+v", ps)
	}
}

// TestObservePubSubLag проверяет, что наблюдатель вызывается только на
// сообщениях с проставленной меткой времени и только с неотрицательной задержкой.
func TestObservePubSubLag(t *testing.T) {
	var got []float64
	store := &RedisStore{}
	store.SetPubSubLagObserver(func(seconds float64) { got = append(got, seconds) })

	// Сообщение без метки времени (старый продюсер) — не замеряем.
	store.observePubSubLag(0)
	if len(got) != 0 {
		t.Fatalf("sentAt=0 must not produce a measurement, got %v", got)
	}

	// Метка в будущем (clock skew) — отрицательную задержку отбрасываем.
	store.observePubSubLag(time.Now().Add(time.Hour).UnixMilli())
	if len(got) != 0 {
		t.Fatalf("negative lag must be dropped, got %v", got)
	}

	store.observePubSubLag(time.Now().Add(-time.Millisecond).UnixMilli())
	if len(got) != 1 || got[0] <= 0 {
		t.Fatalf("expected one positive lag measurement, got %v", got)
	}

	// Nil-наблюдатель не должен ронять замеры.
	store = &RedisStore{}
	store.observePubSubLag(time.Now().UnixMilli())
}

func TestSaveCodeState_InvalidJSON_ReturnsError(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	store := &RedisStore{
		enabled: true,
		client:  &redis.Client{},
		logger:  logger,
	}

	err := store.SaveCodeState(context.Background(), "session-1", []byte("invalid-json{"))
	if err == nil {
		t.Fatal("expected error for invalid code snapshot payload, got nil")
	}
	if !strings.Contains(err.Error(), "invalid code snapshot payload") {
		t.Errorf("expected error to contain %q, got %q", "invalid code snapshot payload", err.Error())
	}
}

