// Package sentry настраивает интеграцию с Sentry (sentry-go).
// При пустом DSN интеграция не активируется: все методы становятся no-op.
package sentry

import (
	"fmt"
	"log/slog"
	"time"

	"github.com/getsentry/sentry-go"
)

// Options содержит параметры инициализации Sentry.
type Options struct {
	DSN              string
	Environment      string
	TracesSampleRate float64
}

// Init инициализирует Sentry. Без DSN ничего не делает (guard-паттерн,
// единый с приложениями на TS: Sentry активируется только при наличии SENTRY_DSN).
func Init(opts Options, logger *slog.Logger) error {
	if opts.DSN == "" {
		logger.Debug("sentry disabled: no SENTRY_DSN set")
		return nil
	}

	err := sentry.Init(sentry.ClientOptions{
		Dsn:              opts.DSN,
		Environment:      opts.Environment,
		TracesSampleRate: opts.TracesSampleRate,
	})
	if err != nil {
		return fmt.Errorf("failed to initialize sentry: %w", err)
	}

	logger.Info("sentry initialized",
		slog.String("environment", opts.Environment),
		slog.Float64("tracesSampleRate", opts.TracesSampleRate),
	)

	return nil
}

// Flush принудительно доставляет накопленные события перед завершением работы.
// Возвращает true, если события отправлены, false — если таймаут истёк.
func Flush(timeout time.Duration) bool {
	if sentry.CurrentHub().Client() == nil {
		return true
	}
	return sentry.Flush(timeout)
}
