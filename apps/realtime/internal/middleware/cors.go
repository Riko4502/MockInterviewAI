package middleware

import (
	"net/http"
	"strings"
)

// CORS настраивает заголовки кросс-доменных запросов на основе белого списка.
func CORS(allowedOrigins []string) func(next http.Handler) http.Handler {
	allowAll := false
	originsMap := make(map[string]bool)

	for _, origin := range allowedOrigins {
		if origin == "*" {
			allowAll = true
			break
		}
		originsMap[strings.ToLower(origin)] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			if allowAll {
				w.Header().Set("Access-Control-Allow-Origin", "*")
			} else if origin != "" && originsMap[strings.ToLower(origin)] {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
			}

			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type, X-Request-ID, X-User-ID")
			w.Header().Set("Access-Control-Allow-Credentials", "true")

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
