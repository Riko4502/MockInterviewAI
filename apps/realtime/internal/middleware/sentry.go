package middleware

import (
	"log/slog"
	"net/http"

	"github.com/getsentry/sentry-go"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
)

// Sentry создает middleware для сбора транзакций и breadcrumb'ов HTTP-запросов.
// Хаб клонируется из текущего и привязывается к контексту запроса, чтобы
// хендлеры могли отправлять события через r.Context().
// Когда Sentry не инициализирован (нет SENTRY_DSN), middleware прозрачен.
func Sentry(logger *slog.Logger) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if sentry.CurrentHub().Client() == nil {
				next.ServeHTTP(w, r)
				return
			}

			hub := sentry.CurrentHub().Clone()
			ctx := sentry.SetHubOnContext(r.Context(), hub)
			r = r.WithContext(ctx)

			requestID := chimiddleware.GetReqID(r.Context())

			span := sentry.StartSpan(ctx, "http.server",
				sentry.WithTransactionName(r.Method+" "+r.URL.Path),
			)
			defer span.Finish()
			// span.Context() сохраняет hub и добавляет span: downstream-хендлеры
			// видят активный span и могут создавать честные дочерние span'ы.
			r = r.WithContext(span.Context())
			span.SetData("url", SanitizeURI(r.URL))
			span.SetTag("request_id", requestID)

			hub.AddBreadcrumb(&sentry.Breadcrumb{
				Category: "http.request",
				Message:  "request started",
				Data: map[string]any{
					"method":     r.Method,
					"path":       r.URL.Path,
					"request_id": requestID,
				},
			}, nil)

			next.ServeHTTP(w, r)

			// chi заполняет r.Pattern шаблоном маршрута ("/api/v1/sessions/{id}")
			// уже после маршрутизации. Используем его как имя транзакции, чтобы
			// path-параметры (sessionId) не раздували cardinality; для
			// неизвестных путей — фиксированное имя.
			if r.Pattern != "" {
				span.Name = r.Method + " " + r.Pattern
				span.Source = sentry.SourceRoute
			} else {
				span.Name = r.Method + " unknown"
			}
		})
	}
}
