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
}
