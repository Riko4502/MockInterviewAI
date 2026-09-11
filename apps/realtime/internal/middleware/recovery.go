package middleware

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"runtime/debug"

	"github.com/getsentry/sentry-go"
)

type errorResponse struct {
	Error   string `json:"error"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Recoverer создает middleware для безопасного перехвата паник.
// При активном Sentry (SENTRY_DSN задан) паника также отправляется в Sentry
// через хаб из контекста запроса.
func Recoverer(logger *slog.Logger) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rvr := recover(); rvr != nil {
					stack := string(debug.Stack())
					logger.Error("panic recovered",
						slog.String("panic", fmt.Sprintf("%v", rvr)),
						slog.String("path", r.URL.Path),
						slog.String("stack", stack),
					)

					capturePanic(r, rvr)

					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusInternalServerError)
					_ = json.NewEncoder(w).Encode(errorResponse{
						Error:   "Internal Server Error",
						Code:    "INTERNAL_PANIC",
						Message: "An unexpected server error occurred",
					})
				}
			}()

			next.ServeHTTP(w, r)
		})
	}
}

// capturePanic отправляет панику в Sentry через хаб из контекста запроса.
// No-op, если Sentry не инициализирован (нет SENTRY_DSN).
func capturePanic(r *http.Request, rvr any) {
	if sentry.CurrentHub().Client() == nil {
		return
	}

	hub := sentry.GetHubFromContext(r.Context())
	if hub == nil {
		hub = sentry.CurrentHub()
	}

	hub.RecoverWithContext(r.Context(), rvr)
}
