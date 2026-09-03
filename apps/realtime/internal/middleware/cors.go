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

			// Браузер отвергает ответ на credentialed-запрос (cookie access_token),
			// если Access-Control-Allow-Origin равен "*", поэтому конкретный origin
			// отражается даже в режиме wildcard. Литеральная "*" остается только
			// для запросов без заголовка Origin, где учетные данные не пересылаются
			// и Allow-Credentials не нужен.
			switch {
			case origin == "" && allowAll:
				w.Header().Set("Access-Control-Allow-Origin", "*")
			case origin != "" && (allowAll || originsMap[strings.ToLower(origin)]):
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Add("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			}

			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Cache-Control, Content-Type, Last-Event-ID, X-Request-ID, X-User-ID")

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
