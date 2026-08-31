package auth

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
)

// generateTestToken вспомогательная функция для создания тестовых JWT токенов.
func generateTestToken(secret, userID, username, sessionID string, ttl time.Duration) (string, error) {
	now := time.Now().UTC()
	claims := UserClaims{
		UserID:    userID,
		Username:  username,
		SessionID: sessionID,
		TokenID:   fmt.Sprintf("tok-%d", now.UnixNano()),
		Type:      "access",
		SID:       "sid-" + userID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			ID:        fmt.Sprintf("tok-%d", now.UnixNano()),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func TestTokenVerification(t *testing.T) {
	secret := "test-super-secret-key-12345"
	verifier := NewTokenVerifier(secret)

	// 1. Проверка валидного токена
	tokenStr, err := generateTestToken(secret, "user-1", "Alice", "session-100", 1*time.Hour)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	claims, err := verifier.VerifyToken(tokenStr)
	if err != nil {
		t.Fatalf("failed to verify valid token: %v", err)
	}

	if claims.UserID != "user-1" || claims.Username != "Alice" || claims.SessionID != "session-100" {
		t.Errorf("claims mismatch: %+v", claims)
	}

	// 2. Проверка токена с неверным секретом
	wrongVerifier := NewTokenVerifier("wrong-secret-key")
	_, err = wrongVerifier.VerifyToken(tokenStr)
	if err == nil {
		t.Error("expected error for token with wrong secret, got nil")
	}

	// 3. Проверка истекшего токена
	expiredTokenStr, err := generateTestToken(secret, "user-1", "Alice", "session-100", -1*time.Minute)
	if err != nil {
		t.Fatalf("failed to generate expired token: %v", err)
	}

	_, err = verifier.VerifyToken(expiredTokenStr)
	if err == nil {
		t.Error("expected error for expired token, got nil")
	}

	// 4. Пустой токен
	_, err = verifier.VerifyToken("")
	if err == nil {
		t.Error("expected error for empty token, got nil")
	}
}

func TestExtractTokenFromRequest(t *testing.T) {
	// 1. Из Cookie 'access_token'
	reqCookie := httptest.NewRequest(http.MethodGet, "/ws", http.NoBody)
	reqCookie.AddCookie(&http.Cookie{Name: "access_token", Value: "token-from-cookie"})
	if tok := ExtractTokenFromRequest(reqCookie, "access_token"); tok != "token-from-cookie" {
		t.Errorf("expected 'token-from-cookie', got '%s'", tok)
	}

	// 2. Из Authorization Bearer
	reqAuth := httptest.NewRequest(http.MethodGet, "/ws", http.NoBody)
	reqAuth.Header.Set("Authorization", "Bearer token-abc")
	if tok := ExtractTokenFromRequest(reqAuth, "access_token"); tok != "token-abc" {
		t.Errorf("expected 'token-abc', got '%s'", tok)
	}

	// 3. Query-параметры должны игнорироваться
	reqQuery := httptest.NewRequest(http.MethodGet, "/ws?token=token-query-1", http.NoBody)
	if tok := ExtractTokenFromRequest(reqQuery, "access_token"); tok != "" {
		t.Errorf("expected empty string for query param token, got '%s'", tok)
	}

	// 4. Bearer имеет приоритет над cookie (закрывает слабость «cookie первичнее Bearer», Phase C).
	reqBoth := httptest.NewRequest(http.MethodGet, "/ws", http.NoBody)
	reqBoth.AddCookie(&http.Cookie{Name: "access_token", Value: "token-from-cookie"})
	reqBoth.Header.Set("Authorization", "Bearer token-bearer")
	if tok := ExtractTokenFromRequest(reqBoth, "access_token"); tok != "token-bearer" {
		t.Errorf("expected bearer token to win over cookie, got '%s'", tok)
	}
}

func TestExtractTicketFromProtocol(t *testing.T) {
	tests := []struct {
		name   string
		header string
		want   string
	}{
		{"subprotocol с тикетом", "realtime,abc.def.ghi", "abc.def.ghi"},
		{"пустой заголовок", "", ""},
		{"только realtime", "realtime", ""},
		{"один токен без запятой", "realtime<no-comma>", ""},
		{"битый формат", "realtime,", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ExtractTicketFromProtocol(tt.header); got != tt.want {
				t.Errorf("ExtractTicketFromProtocol(%q) = %q, want %q", tt.header, got, tt.want)
			}
		})
	}
}

// signTestToken подписывает токен с заданными claims (для кейсов typ/sid).
func signTestToken(t *testing.T, secret string, claims UserClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("failed to sign test token: %v", err)
	}
	return signed
}

func TestTokenVerificationTypSID(t *testing.T) {
	secret := "test-super-secret-key-12345"
	verifier := NewTokenVerifier(secret)
	now := time.Now().UTC()
	base := func() UserClaims {
		return UserClaims{
			UserID:    "user-1",
			Username:  "Alice",
			SessionID: "session-100",
			SID:       "sid-1",
			Type:      "access",
			RegisteredClaims: jwt.RegisteredClaims{
				Subject:   "user-1",
				ID:        "tok-1",
				IssuedAt:  jwt.NewNumericDate(now),
				ExpiresAt: jwt.NewNumericDate(now.Add(1 * time.Hour)),
			},
		}
	}

	// 1. Валидный access с typ + sid — проходит.
	tok := signTestToken(t, secret, base())
	if _, err := verifier.VerifyToken(tok); err != nil {
		t.Fatalf("expected valid access token to pass, got error: %v", err)
	}

	// 2. Неверный typ — ошибка.
	invalid := base()
	invalid.Type = "refresh"
	if _, err := verifier.VerifyToken(signTestToken(t, secret, invalid)); err == nil {
		t.Error("expected error for token with invalid typ, got nil")
	}

	// 3. Пустой typ — ошибка.
	noTyp := base()
	noTyp.Type = ""
	if _, err := verifier.VerifyToken(signTestToken(t, secret, noTyp)); err == nil {
		t.Error("expected error for token with empty typ, got nil")
	}

	// 4. Пустой sid — ошибка.
	noSID := base()
	noSID.SID = ""
	if _, err := verifier.VerifyToken(signTestToken(t, secret, noSID)); err == nil {
		t.Error("expected error for token with empty sid, got nil")
	}
}
