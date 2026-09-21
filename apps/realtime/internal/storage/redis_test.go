package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strings"
	"sync"
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

func TestSeedTaskDoc_FiveStatesAndConcurrency(t *testing.T) {
	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = "localhost:6379"
	}
	pass := os.Getenv("REDIS_PASSWORD")
	if pass == "" {
		pass = "change-me-redis-password-local"
	}

	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: pass,
	})
	defer rdb.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		t.Skipf("Redis is not available at %s, skipping integration test: %v", addr, err)
	}

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	store := &RedisStore{
		enabled:    true,
		client:     rdb,
		instanceID: "test-instance",
		logger:     logger,
	}

	sessionID := fmt.Sprintf("test-sess-%d", time.Now().UnixNano())
	taskKey := "task-1:typescript"
	starterUpdate := "base64StarterUpdateData=="
	const ttlSeconds = int64(86400)

	markerHashKey := fmt.Sprintf("{session:%s}:seeded_tasks", sessionID)
	streamKey := fmt.Sprintf("{session:%s}:task:%s:updates", sessionID, taskKey)

	// Гарантированная очистка ключей после теста
	defer func() {
		cleanCtx := context.Background()
		rdb.Del(cleanCtx, markerHashKey, streamKey)
	}()

	// -------------------------------------------------------------
	// СЛУЧАЙ 5: Первичный сидинг (marker нет, stream нет) -> return 1
	// -------------------------------------------------------------
	status, err := store.SeedTaskDoc(ctx, sessionID, taskKey, starterUpdate, ttlSeconds)
	if err != nil {
		t.Fatalf("Case 5: unexpected error: %v", err)
	}
	if status != 1 {
		t.Errorf("Case 5: expected status=1 (primary seeding), got %d", status)
	}

	// Проверяем наличие маркера
	hexists, err := rdb.HExists(ctx, markerHashKey, taskKey).Result()
	if err != nil || !hexists {
		t.Errorf("Case 5: expected marker in hash, hexists=%v, err=%v", hexists, err)
	}

	// Проверяем наличие стартовой дельты в стриме
	updates, err := store.GetTaskUpdates(ctx, sessionID, taskKey)
	if err != nil {
		t.Fatalf("Case 5: GetTaskUpdates failed: %v", err)
	}
	if len(updates) != 1 || updates[0] != starterUpdate {
		t.Errorf("Case 5: expected [starterUpdate], got %v", updates)
	}

	// Проверяем установку TTL
	ttlStream, _ := rdb.TTL(ctx, streamKey).Result()
	ttlHash, _ := rdb.TTL(ctx, markerHashKey).Result()
	if ttlStream <= 0 || ttlStream > 86400*time.Second {
		t.Errorf("Case 5: invalid stream TTL: %v", ttlStream)
	}
	if ttlHash <= 0 || ttlHash > 86400*time.Second {
		t.Errorf("Case 5: invalid hash TTL: %v", ttlHash)
	}

	// -------------------------------------------------------------
	// СЛУЧАЙ 1: Валидное состояние (marker есть, stream_len > 0) -> return 0
	// -------------------------------------------------------------
	status, err = store.SeedTaskDoc(ctx, sessionID, taskKey, "should-not-be-added", ttlSeconds)
	if err != nil {
		t.Fatalf("Case 1: unexpected error: %v", err)
	}
	if status != 0 {
		t.Errorf("Case 1: expected status=0 (no-op), got %d", status)
	}

	// Длина стрима не изменилась
	updates, err = store.GetTaskUpdates(ctx, sessionID, taskKey)
	if err != nil {
		t.Fatalf("Case 1: GetTaskUpdates failed: %v", err)
	}
	if len(updates) != 1 || updates[0] != starterUpdate {
		t.Errorf("Case 1: stream content modified! Got %v", updates)
	}

	// -------------------------------------------------------------
	// СЛУЧАЙ 2/3: Восстановление стрима (marker есть, stream отсутствует) -> return 3
	// -------------------------------------------------------------
	// Симулируем истечение стрима по TTL
	if err := rdb.Del(ctx, streamKey).Err(); err != nil {
		t.Fatalf("failed to simulate stream expiration: %v", err)
	}

	status, err = store.SeedTaskDoc(ctx, sessionID, taskKey, starterUpdate, ttlSeconds)
	if err != nil {
		t.Fatalf("Case 2: unexpected error: %v", err)
	}
	if status != 3 {
		t.Errorf("Case 2: expected status=3 (stream recovered with template), got %d", status)
	}

	// Стрим восстановлен со стартовой дельтой
	updates, err = store.GetTaskUpdates(ctx, sessionID, taskKey)
	if err != nil {
		t.Fatalf("Case 2: GetTaskUpdates failed: %v", err)
	}
	if len(updates) != 1 || updates[0] != starterUpdate {
		t.Errorf("Case 2: expected stream to be restored with starter template, got %v", updates)
	}

	// -------------------------------------------------------------
	// СЛУЧАЙ 4: Восстановление маркера (marker отсутствует, stream_len > 0) -> return 2
	// -------------------------------------------------------------
	// Симулируем рассинхронизацию: удаляем только маркер из хэша
	if err := rdb.HDel(ctx, markerHashKey, taskKey).Err(); err != nil {
		t.Fatalf("failed to delete marker: %v", err)
	}

	status, err = store.SeedTaskDoc(ctx, sessionID, taskKey, "another-delta-not-inserted", ttlSeconds)
	if err != nil {
		t.Fatalf("Case 4: unexpected error: %v", err)
	}
	if status != 2 {
		t.Errorf("Case 4: expected status=2 (marker restored without duplicate XADD), got %d", status)
	}

	// Маркер восстановлен
	hexists, err = rdb.HExists(ctx, markerHashKey, taskKey).Result()
	if err != nil || !hexists {
		t.Errorf("Case 4: expected marker to be restored, hexists=%v", hexists)
	}

	// В стрим ничего лишнего не записано
	updates, err = store.GetTaskUpdates(ctx, sessionID, taskKey)
	if err != nil {
		t.Fatalf("Case 4: GetTaskUpdates failed: %v", err)
	}
	if len(updates) != 1 || updates[0] != starterUpdate {
		t.Errorf("Case 4: duplicate delta inserted into stream! Got %v", updates)
	}

	// -------------------------------------------------------------
	// КОНКУРЕНТНЫЕ ВЫЗОВЫ: Сериализация вызовов для одного hash-slot
	// -------------------------------------------------------------
	concurrentSessionID := fmt.Sprintf("test-concurrent-%d", time.Now().UnixNano())
	concurrentTaskKey := "task-concurrent:go"
	concurrentMarkerKey := fmt.Sprintf("{session:%s}:seeded_tasks", concurrentSessionID)
	concurrentStreamKey := fmt.Sprintf("{session:%s}:task:%s:updates", concurrentSessionID, concurrentTaskKey)

	defer rdb.Del(context.Background(), concurrentMarkerKey, concurrentStreamKey)

	var wg sync.WaitGroup
	const workers = 10
	results := make([]int, workers)
	errorsList := make([]error, workers)

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			res, err := store.SeedTaskDoc(context.Background(), concurrentSessionID, concurrentTaskKey, starterUpdate, ttlSeconds)
			results[idx] = res
			errorsList[idx] = err
		}(i)
	}

	wg.Wait()

	primaryCount := 0
	noopCount := 0
	for i := 0; i < workers; i++ {
		if errorsList[i] != nil {
			t.Errorf("Concurrent worker %d failed: %v", i, errorsList[i])
		}
		if results[i] == 1 {
			primaryCount++
		} else if results[i] == 0 {
			noopCount++
		}
	}

	// Ровно один вызов должен выполнить первичный сидинг, остальные - no-op (status=0)
	if primaryCount != 1 {
		t.Errorf("Concurrent: expected exactly 1 primary seeding (status=1), got %d (results: %v)", primaryCount, results)
	}
	if noopCount != workers-1 {
		t.Errorf("Concurrent: expected %d no-ops (status=0), got %d", workers-1, noopCount)
	}

	// В стриме задачи должна быть ровно 1 начальная дельта
	cUpdates, err := store.GetTaskUpdates(ctx, concurrentSessionID, concurrentTaskKey)
	if err != nil {
		t.Fatalf("Concurrent: GetTaskUpdates failed: %v", err)
	}
	if len(cUpdates) != 1 {
		t.Errorf("Concurrent: expected exactly 1 delta in stream, got %d", len(cUpdates))
	}

	// -------------------------------------------------------------
	// Проверка методов AppendTaskUpdate и TouchTaskStream
	// -------------------------------------------------------------
	secondDelta := "secondDeltaBase64=="
	entryID, err := store.AppendTaskUpdate(ctx, concurrentSessionID, concurrentTaskKey, secondDelta)
	if err != nil || entryID == "" {
		t.Fatalf("AppendTaskUpdate failed: %v, entryID=%s", err, entryID)
	}

	cUpdates, err = store.GetTaskUpdates(ctx, concurrentSessionID, concurrentTaskKey)
	if err != nil || len(cUpdates) != 2 || cUpdates[1] != secondDelta {
		t.Errorf("Expected 2 updates after append, got %v", cUpdates)
	}

	if err := store.TouchTaskStream(ctx, concurrentSessionID, concurrentTaskKey, 12*time.Hour); err != nil {
		t.Fatalf("TouchTaskStream failed: %v", err)
	}
}
