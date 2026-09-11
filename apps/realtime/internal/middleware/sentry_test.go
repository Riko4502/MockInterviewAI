package middleware

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

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