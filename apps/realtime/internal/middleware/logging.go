package middleware

import (
	"log/slog"
	"net/http"
	"net/url"
	"time"

	chimiddleware "github.com/go-chi/chi/v5/middleware"
)

// RequestLogger создает middleware для структурированного логирования HTTP-запросов с безопасным маскированием токенов.
func RequestLogger(logger *slog.Logger) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := chimiddleware.NewWrapResponseWriter(w, r.ProtoMajor)

			next.ServeHTTP(ww, r)

			latency := time.Since(start)

			logger.Info("http request",
				slog.String("method", r.Method),
				slog.String("path", SanitizeURI(r.URL)),
				slog.Int("status", ww.Status()),
				slog.Int("bytes", ww.BytesWritten()),
				slog.Duration("latency", latency),
				slog.String("remote_addr", r.RemoteAddr),
				slog.String("user_agent", r.UserAgent()),
			)
		})
	}
}

// SanitizeURI маскирует конфиденциальные параметры (token, access_token, secret) в URL перед записью в логи.
func SanitizeURI(u *url.URL) string {
	if u == nil {
		return ""
	}

	if u.RawQuery == "" {
		return u.Path
	}

	query := u.Query()
	hasSensitive := false

	for _, key := range []string{"access_token", "token", "secret"} {
		if query.Has(key) {
			query.Set(key, "[REDACTED]")
			hasSensitive = true
		}
	}

	if !hasSensitive {
		return u.RequestURI()
	}

	return u.Path + "?" + query.Encode()
}
