package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// serveCORS прогоняет запрос через middleware и возвращает записанный ответ.
func serveCORS(t *testing.T, allowedOrigins []string, origin string) *httptest.ResponseRecorder {
	t.Helper()

	handler := CORS(allowedOrigins)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/sse/notifications", http.NoBody)
	if origin != "" {
		req.Header.Set("Origin", origin)
	}

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	return rec
}

// TestCORSNeverPairsWildcardWithCredentials закрывает регрессию: связку
// "Access-Control-Allow-Origin: *" и "Access-Control-Allow-Credentials: true"
// браузер отвергает, из-за чего EventSource с cookie access_token не работал
// при ALLOWED_ORIGINS=*.
func TestCORSNeverPairsWildcardWithCredentials(t *testing.T) {
	rec := serveCORS(t, []string{"*"}, "http://localhost:3000")

	origin := rec.Header().Get("Access-Control-Allow-Origin")
	credentials := rec.Header().Get("Access-Control-Allow-Credentials")

	if origin == "*" && credentials == "true" {
		t.Fatal("wildcard origin must never be paired with Allow-Credentials")
	}

	// В режиме wildcard конкретный origin отражается, чтобы запросы с cookie работали.
	if origin != "http://localhost:3000" {
		t.Errorf("expected the origin to be echoed back, got %q", origin)
	}

	if credentials != "true" {
		t.Errorf("expected credentials to be allowed for an echoed origin, got %q", credentials)
	}

	if vary := rec.Header().Get("Vary"); vary != "Origin" {
		t.Errorf("echoed origin must be accompanied by Vary: Origin, got %q", vary)
	}
}

// TestCORSWildcardWithoutOriginHeader фиксирует, что для запросов без Origin
// (curl, скрейперы) в режиме wildcard по-прежнему отдается "*", но без
// Allow-Credentials — учетные данные в таких запросах не пересылаются.
func TestCORSWildcardWithoutOriginHeader(t *testing.T) {
	rec := serveCORS(t, []string{"*"}, "")

	if origin := rec.Header().Get("Access-Control-Allow-Origin"); origin != "*" {
		t.Errorf("expected wildcard origin, got %q", origin)
	}

	if credentials := rec.Header().Get("Access-Control-Allow-Credentials"); credentials != "" {
		t.Errorf("credentials must not be advertised alongside a wildcard, got %q", credentials)
	}
}

// TestCORSHonoursWhitelist проверяет режим явного белого списка.
func TestCORSHonoursWhitelist(t *testing.T) {
	allowed := []string{"http://localhost:3000"}

	rec := serveCORS(t, allowed, "http://localhost:3000")
	if origin := rec.Header().Get("Access-Control-Allow-Origin"); origin != "http://localhost:3000" {
		t.Errorf("expected the whitelisted origin to be echoed, got %q", origin)
	}

	foreign := serveCORS(t, allowed, "http://evil.example")
	if origin := foreign.Header().Get("Access-Control-Allow-Origin"); origin != "" {
		t.Errorf("foreign origin must not receive Allow-Origin, got %q", origin)
	}

	if credentials := foreign.Header().Get("Access-Control-Allow-Credentials"); credentials != "" {
		t.Errorf("foreign origin must not receive Allow-Credentials, got %q", credentials)
	}
}
