package middleware

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/getsentry/sentry-go"
)

type mockSentryTransport struct {
	lastEvent *sentry.Event
}

func (t *mockSentryTransport) SendEvent(event *sentry.Event) {
	t.lastEvent = event
}

func (t *mockSentryTransport) Flush(_ time.Duration) bool              { return true }
func (t *mockSentryTransport) FlushWithContext(_ context.Context) bool { return true }
func (t *mockSentryTransport) Configure(_ sentry.ClientOptions)        {}
func (t *mockSentryTransport) Close()                                  {}

func TestRecovererReturns500OnPanic(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := Recoverer(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("boom")
	}))

	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, rr.Code)
	}

	var body struct {
		Code string `json:"code"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid JSON body: %v", err)
	}
	if body.Code != "INTERNAL_PANIC" {
		t.Fatalf("expected code INTERNAL_PANIC, got %q", body.Code)
	}
}

// Проверяет, что Sentry middleware регистрируется до Recoverer: при panic
// событие захватывается через request-scoped hub и содержит breadcrumb
// Sentry middleware. При обратном порядке (Recoverer снаружи) в context
// запроса нет hub, capturePanic падает на глобальный hub и breadcrumb теряется.
func TestRecovererCapturesPanicViaRequestHub(t *testing.T) {
	transport := &mockSentryTransport{}
	if err := sentry.Init(sentry.ClientOptions{
		Dsn:       "http://foo@bar:1/foo",
		Transport: transport,
	}); err != nil {
		t.Fatalf("sentry.Init: %v", err)
	}

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := Sentry(logger)(Recoverer(logger)(http.HandlerFunc(func(
		w http.ResponseWriter,
		r *http.Request,
	) {
		panic("boom")
	})))

	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, rr.Code)
	}
	if transport.lastEvent == nil {
		t.Fatal("expected panic event sent to Sentry")
	}

	found := false
	for _, b := range transport.lastEvent.Breadcrumbs {
		if b.Category == "http.request" {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("expected http.request breadcrumb from Sentry middleware on captured event")
	}
}
