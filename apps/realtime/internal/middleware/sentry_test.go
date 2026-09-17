package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/getsentry/sentry-go"
)

// noopTransport имитирует отправку событий в Sentry без сети.
type noopTransport struct{}

func (noopTransport) Configure(sentry.ClientOptions)          {}
func (noopTransport) SendEvent(*sentry.Event)                 {}
func (noopTransport) Flush(time.Duration) bool                { return true }
func (noopTransport) FlushWithContext(context.Context) bool   { return true }
func (noopTransport) Close()                                  {}

// Sentry-подключение требует валидного DSN и сети. Здесь проверяется
// прозрачность middleware, когда Sentry не инициализирован (нет SENTRY_DSN):
// запрос должен пройти сквозь без побочных эффектов.
func TestSentryMiddlewarePassthroughWhenDisabled(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(nil, nil))
	handler := Sentry(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d", http.StatusNoContent, rr.Code)
	}
}

// Проверяет, что middleware прокидывает активный span и клонированный hub
// в контекст запроса: downstream-хендлеры должны видеть span (дочерние span'ы)
// и hub (события/breadcrumb'ы).
func TestSentryMiddlewarePropagatesSpanToHandler(t *testing.T) {
	if err := sentry.Init(sentry.ClientOptions{
		Dsn:       "https://public@example.com/1",
		Transport: noopTransport{},
	}); err != nil {
		t.Fatalf("sentry.Init: %v", err)
	}
	t.Cleanup(func() {
		sentry.Flush(2 * time.Second)
		sentry.CurrentHub().Client().Close()
	})

	logger := slog.New(slog.NewTextHandler(nil, nil))

	var sawSpan, sawHub bool
	handler := Sentry(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawSpan = sentry.SpanFromContext(r.Context()) != nil
		sawHub = sentry.GetHubFromContext(r.Context()) != nil
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d", http.StatusNoContent, rr.Code)
	}
	if !sawSpan {
		t.Error("expected an active span in the handler context")
	}
	if !sawHub {
		t.Error("expected the cloned hub in the handler context")
	}
}
