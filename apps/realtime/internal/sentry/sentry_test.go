package sentry

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/getsentry/sentry-go"
)

func newTestLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestInitEmptyDSNDisablesSentry(t *testing.T) {
	logger := newTestLogger()

	if err := Init(Options{DSN: "", Environment: "development"}, logger); err != nil {
		t.Fatalf("Init with empty DSN returned error: %v", err)
	}

	if Flush(time.Second) != true {
		t.Fatal("Flush on disabled Sentry (no DSN) should return true (no-op)")
	}
}

func TestInitWithTracesSampleRateEnablesTracing(t *testing.T) {
	logger := newTestLogger()

	if err := Init(Options{
		DSN:              "https://public@example.com/1",
		Environment:      "development",
		TracesSampleRate: 1.0,
	}, logger); err != nil {
		t.Fatalf("Init returned error: %v", err)
	}
	t.Cleanup(func() {
		sentry.CurrentHub().Client().Close()
	})

	// StartSpan принимает решение о семплировании отверстием (sample() в
	// StartSpan). Без EnableTracing span всегда SampledFalse, поэтому проверка
	// именно на SampledTrue подтверждает, что tracing включён.
	span := sentry.StartSpan(context.Background(), "http.server")
	if span.Sampled != sentry.SampledTrue {
		t.Fatalf("expected sampled span with TracesSampleRate > 0, got %v", span.Sampled)
	}
}

func TestInitWithZeroTracesRateKeepsTracingDisabled(t *testing.T) {
	logger := newTestLogger()

	if err := Init(Options{
		DSN:              "https://public@example.com/1",
		Environment:      "development",
		TracesSampleRate: 0,
	}, logger); err != nil {
		t.Fatalf("Init returned error: %v", err)
	}
	t.Cleanup(func() {
		sentry.CurrentHub().Client().Close()
	})

	span := sentry.StartSpan(context.Background(), "http.server")
	if span.Sampled != sentry.SampledFalse {
		t.Fatalf("expected unsampled span with TracesSampleRate == 0, got %v", span.Sampled)
	}
}
