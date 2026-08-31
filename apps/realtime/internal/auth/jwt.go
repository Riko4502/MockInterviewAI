package auth

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	jwt "github.com/golang-jwt/jwt/v5"
)

var (
	// ErrMissingToken означает, что токен аутентификации отсутствует.
	ErrMissingToken = errors.New("authentication token is required")

	// ErrInvalidToken означает, что токен аутентификации недействителен или истёк.
	ErrInvalidToken = errors.New("invalid or expired authentication token")

	// ErrInvalidSigningAlg означает, что используется неожиданный алгоритм подписи токена.
	ErrInvalidSigningAlg = errors.New("unexpected token signing algorithm")
)

// UserClaims содержит данные аутентифицированного пользователя из JWT (Access Token / Realtime Ticket).
type UserClaims struct {
	UserID    string `json:"userId"`
	Username  string `json:"username"`
	SessionID string `json:"sessionId,omitempty"`
	TokenID   string `json:"jti,omitempty"`
	Type      string `json:"typ,omitempty"`
	SID       string `json:"sid,omitempty"`
	jwt.RegisteredClaims
}

// TokenVerifier проверяет подпись и валидность JWT токенов.
type TokenVerifier struct {
	secret []byte
}

// NewTokenVerifier создает верификатор токенов с переданным секретным ключом.
func NewTokenVerifier(secret string) *TokenVerifier {
	return &TokenVerifier{
		secret: []byte(secret),
	}
}

// VerifyToken проверяет JWT токен и возвращает UserClaims.
func (v *TokenVerifier) VerifyToken(tokenString string) (*UserClaims, error) {
	if strings.TrimSpace(tokenString) == "" {
		return nil, ErrMissingToken
	}

	token, err := jwt.ParseWithClaims(
		tokenString,
		&UserClaims{},
		func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("%w: %v", ErrInvalidSigningAlg, t.Header["alg"])
			}
			return v.secret, nil
		},
	)

	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidToken, err)
	}

	claims, ok := token.Claims.(*UserClaims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}

	// Если UserID пустой, берем из Subject (стандартное поле JWT)
	if claims.UserID == "" && claims.Subject != "" {
		claims.UserID = claims.Subject
	}

	if claims.UserID == "" {
		return nil, errors.New("token must contain userId or sub")
	}

	// Строгая валидация типа токена (Phase B): допускаются только access/realtime.
	if claims.Type != "access" && claims.Type != "realtime" {
		return nil, errors.New("token must declare valid typ (access|realtime)")
	}

	// Живой auth-сессии требует непустой sid (связь с auth:session:{sid}).
	if claims.SID == "" {
		return nil, errors.New("token must contain sid")
	}

	return claims, nil
}

// ExtractTokenFromRequest извлекает JWT токен строго из:
// 1. HTTP Cookie по указанному cookieName (или "access_token", если имя не задано)
// 2. HTTP Заголовка 'Authorization: Bearer <token>'
func ExtractTokenFromRequest(r *http.Request, cookieName string) string {
	if cookieName == "" {
		cookieName = "access_token"
	}

	// 1. Извлечение из HTTP Cookie
	if cookie, err := r.Cookie(cookieName); err == nil && strings.TrimSpace(cookie.Value) != "" {
		return strings.TrimSpace(cookie.Value)
	}

	// 2. Authorization header (Bearer <token>)
	authHeader := r.Header.Get("Authorization")
	if token, found := strings.CutPrefix(authHeader, "Bearer "); found {
		return strings.TrimSpace(token)
	}

	return ""
}
