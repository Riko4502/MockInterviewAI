package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/go-chi/chi/v5"
)

// noopTransport имитирует отправку событий в Sentry без сети.
type noopTransport struct{}

func (noopTransport) Configure(sentry.ClientOptions)        {}
func (noopTransport) SendEvent(*sentry.Event)               {}
func (noopTransport) Flush(time.Duration) bool              { return true }
func (noopTransport) FlushWithContext(context.Context) bool { return true }
func (noopTransport) Close()                                {}

// captureTransport сохраняет отправленные события для проверок в тестах.
type captureTransport struct {
	mu     sync.Mutex
	events []*sentry.Event
}

func (*captureTransport) Configure(sentry.ClientOptions)        {}
func (*captureTransport) Flush(time.Duration) bool              { return true }
func (*captureTransport) FlushWithContext(context.Context) bool { return true }
func (*captureTransport) Close()                                {}

func (t *captureTransport) SendEvent(event *sentry.Event) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.events = append(t.events, event)
}

func (t *captureTransport) Events() []*sentry.Event {
	t.mu.Lock()
	defer t.mu.Unlock()
	return append([]*sentry.Event(nil), t.events...)
}

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
		Dsn:              "https://public@example.com/1",
		Transport:        noopTransport{},
		EnableTracing:    true,
		TracesSampleRate: 1.0,
	}); err != nil {
		t.Fatalf("sentry.Init: %v", err)
	}
	t.Cleanup(func() {
		sentry.Flush(2 * time.Second)
		if client := sentry.CurrentHub().Client(); client != nil {
			client.Close()
		}
		sentry.CurrentHub().BindClient(nil)
	})

	logger := slog.New(slog.NewTextHandler(nil, nil))

	var sawSpan, sawHub bool
	var sampled sentry.Sampled
	handler := Sentry(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawSpan = sentry.SpanFromContext(r.Context()) != nil
		sawHub = sentry.GetHubFromContext(r.Context()) != nil
		if span := sentry.SpanFromContext(r.Context()); span != nil {
			sampled = span.Sampled
		}
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
	if sampled != sentry.SampledTrue {
		t.Errorf("expected sampled span (EnableTracing + rate=1), got %v", sampled)
	}
}

// Проверяет, что имя транзакции берется из route pattern chi, а не из
// фактического URL: иначе sessionId и случайные пути создают неограниченную
// cardinality транзакций в Sentry.
func TestSentryMiddlewareUsesRoutePatternForTransactionName(t *testing.T) {
	transport := &captureTransport{}
	if err := sentry.Init(sentry.ClientOptions{
		Dsn:              "https://public@example.com/1",
		Transport:        transport,
		EnableTracing:    true,
		TracesSampleRate: 1.0,
	}); err != nil {
		t.Fatalf("sentry.Init: %v", err)
	}
	t.Cleanup(func() {
		sentry.Flush(2 * time.Second)
		if client := sentry.CurrentHub().Client(); client != nil {
			client.Close()
		}
		sentry.CurrentHub().BindClient(nil)
	})

	logger := slog.New(slog.NewTextHandler(nil, nil))
	router := chi.NewRouter()
	router.Use(Sentry(logger))
	router.Get("/api/v1/sessions/{sessionId}", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/api/v1/sessions/abc123", nil))
	router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/does-not-exist/random-path", nil))

	events := transport.Events()
	if len(events) != 2 {
		t.Fatalf("expected 2 transaction events, got %d", len(events))
	}

	if got := events[0].Transaction; got != "GET /api/v1/sessions/{sessionId}" {
		t.Errorf("transaction name = %q, want route pattern", got)
	}
	if events[0].TransactionInfo == nil || events[0].TransactionInfo.Source != sentry.SourceRoute {
		t.Errorf("expected transaction source %q, got %+v", sentry.SourceRoute, events[0].TransactionInfo)
	}
	if got := events[1].Transaction; got != "GET unknown" {
		t.Errorf("unmatched transaction name = %q, want fixed name", got)
	}
}
