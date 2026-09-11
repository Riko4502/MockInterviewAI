package sentry

import (
	"log/slog"
	"testing"
	"time"
)

func TestInitEmptyDSNDisablesSentry(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(nil, nil))

	if err := Init(Options{DSN: "", Environment: "development"}, logger); err != nil {
		t.Fatalf("Init with empty DSN returned error: %v", err)
	}

	if Flush(time.Second) != true {
		t.Fatal("Flush on disabled Sentry (no DSN) should return true (no-op)")
	}
}