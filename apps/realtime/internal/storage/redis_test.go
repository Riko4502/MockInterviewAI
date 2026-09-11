package storage

import (
	"testing"
	"time"
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
	store.SetPubSubLagObserver(nil)
	store.observePubSubLag(time.Now().UnixMilli())
}
