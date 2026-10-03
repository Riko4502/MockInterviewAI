// Package middleware содержит HTTP-middleware сервиса выполнения кода.
package middleware

import (
	"crypto/subtle"
	"net/http"
)

// InternalTokenHeader — заголовок общего секрета для вызовов из apps/api и apps/realtime.
const InternalTokenHeader = "X-Internal-Token"

// InternalAuth требует общий секрет во всех запросах, кроме проб.
//
// При пустом token middleware пропускает запросы без проверки: это режим
// локальной разработки. В production пустой токен отсекается конфигурацией
// (config.Load возвращает ошибку), поэтому сервис с открытым /run не стартует.
func InternalAuth(token string, skipPaths ...string) func(http.Handler) http.Handler {
	skip := make(map[string]struct{}, len(skipPaths))
	for _, path := range skipPaths {
		skip[path] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if token == "" {
				next.ServeHTTP(w, r)
				return
			}

			if _, ok := skip[r.URL.Path]; ok {
				next.ServeHTTP(w, r)
				return
			}

			provided := r.Header.Get(InternalTokenHeader)

			// Сравнение за константное время: побайтовый выход по первому
			// несовпадению даёт возможность подобрать токен по времени ответа.
			if subtle.ConstantTimeCompare([]byte(provided), []byte(token)) != 1 {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = w.Write([]byte(`{"error":"unauthorized"}`))

				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
