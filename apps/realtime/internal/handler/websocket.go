package handler

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"github.com/coder/websocket"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/mockinterviewai/realtime/internal/auth"
	"github.com/mockinterviewai/realtime/internal/storage"
	"github.com/mockinterviewai/realtime/internal/ws"
)

// WebSocketHandler управляет аутентификацией и апгрейдом соединений до WebSocket.
type WebSocketHandler struct {
	hub            *ws.Hub
	tokenVerifier  *auth.TokenVerifier
	sessionStore   storage.SessionStore
	logger         *slog.Logger
	allowedOrigins []string
	cookieName     string
	maxConnections int
	maxRoomClients int
}

// NewWebSocketHandler создает новый экземпляр WebSocketHandler.
func NewWebSocketHandler(
	hub *ws.Hub,
	tokenVerifier *auth.TokenVerifier,
	sessionStore storage.SessionStore,
	logger *slog.Logger,
	allowedOrigins []string,
	cookieName string,
	maxConnections int,
	maxRoomClients int,
) *WebSocketHandler {
	if cookieName == "" {
		cookieName = "access_token"
	}
	return &WebSocketHandler{
		hub:            hub,
		tokenVerifier:  tokenVerifier,
		sessionStore:   sessionStore,
		logger:         logger.With(slog.String("component", "websocket_handler")),
		allowedOrigins: allowedOrigins,
		cookieName:     cookieName,
		maxConnections: maxConnections,
		maxRoomClients: maxRoomClients,
	}
}

// HandleSessionWS обрабатывает подключение к комнате сессии: GET /ws/sessions/{sessionId}.
func (h *WebSocketHandler) HandleSessionWS(w http.ResponseWriter, r *http.Request) {
	sessionID := strings.TrimSpace(chi.URLParam(r, "sessionId"))
	if sessionID == "" {
		http.Error(w, "sessionId is required in URL path", http.StatusBadRequest)
		return
	}

	// 0. Защита от переполнения соединений (Connection Flooding & Room Capacity Limit)
	if h.maxConnections > 0 && h.hub.TotalClients() >= h.maxConnections {
		h.logger.Warn("websocket connection rejected: global max connections reached",
			slog.Int("totalClients", h.hub.TotalClients()),
			slog.Int("limit", h.maxConnections),
		)
		http.Error(w, "Service Unavailable: connection limit reached", http.StatusServiceUnavailable)
		return
	}

	if room, exists := h.hub.GetRoom(sessionID); exists && h.maxRoomClients > 0 && room.ParticipantCount() >= h.maxRoomClients {
		h.logger.Warn("websocket connection rejected: room participant limit reached",
			slog.String("sessionId", sessionID),
			slog.Int("participants", room.ParticipantCount()),
			slog.Int("limit", h.maxRoomClients),
		)
		http.Error(w, "Forbidden: room is full", http.StatusForbidden)
		return
	}

	// 1. Извлечение JWT токена из Cookie или Authorization Header
	rawToken := auth.ExtractTokenFromRequest(r, h.cookieName)
	if rawToken == "" {
		h.logger.Warn("websocket connection rejected: missing auth token", slog.String("sessionId", sessionID))
		http.Error(w, "Unauthorized: missing authentication token", http.StatusUnauthorized)
		return
	}

	claims, err := h.tokenVerifier.VerifyToken(rawToken)
	if err != nil {
		h.logger.Warn("websocket connection rejected: invalid auth token",
			slog.String("sessionId", sessionID),
			slog.String("error", err.Error()),
		)
		http.Error(w, "Unauthorized: invalid or expired token", http.StatusUnauthorized)
		return
	}

	// 2. Проверка отзыва токена в Redis (если настроен)
	if h.sessionStore != nil && claims.TokenID != "" {
		if revoked, checkErr := h.sessionStore.IsTokenRevoked(r.Context(), claims.TokenID); checkErr == nil && revoked {
			h.logger.Warn("websocket connection rejected: token has been revoked in redis",
				slog.String("userId", claims.UserID),
				slog.String("tokenId", claims.TokenID),
			)
			http.Error(w, "Unauthorized: token is revoked", http.StatusUnauthorized)
			return
		}
	}

	// 3. Проверка соответствия sessionId в токене (если указан в claims)
	if claims.SessionID != "" && claims.SessionID != sessionID {
		h.logger.Warn("websocket connection rejected: session id mismatch in token",
			slog.String("urlSessionId", sessionID),
			slog.String("tokenSessionId", claims.SessionID),
		)
		http.Error(w, "Forbidden: access denied for this session", http.StatusForbidden)
		return
	}

	// 4. Проверка активности сессии в Redis (не закрыта ли сессия интервью)
	if h.sessionStore != nil {
		if active, checkErr := h.sessionStore.IsSessionActive(r.Context(), sessionID); checkErr == nil && !active {
			h.logger.Warn("websocket connection rejected: session is closed",
				slog.String("sessionId", sessionID),
			)
			http.Error(w, "Forbidden: session is closed", http.StatusForbidden)
			return
		}
	}

	// 5. Настройка параметров апгрейда
	opts := &websocket.AcceptOptions{
		OriginPatterns: h.allowedOrigins,
	}

	conn, err := websocket.Accept(w, r, opts)
	if err != nil {
		h.logger.Warn("failed to accept websocket connection",
			slog.String("sessionId", sessionID),
			slog.String("origin", r.Header.Get("Origin")),
			slog.String("error", err.Error()),
		)
		return
	}

	// 6. Регистрация клиента в комнате
	room := h.hub.GetOrCreateRoom(sessionID)
	clientID := uuid.NewString()

	username := claims.Username
	if username == "" {
		username = "User-" + claims.UserID
	}

	// Роль пользователя берется исключительно из проверенного сессионного хранилища Redis
	role := "candidate"
	if h.sessionStore != nil {
		if redisRole, roleErr := h.sessionStore.GetSessionUserRole(r.Context(), sessionID, claims.UserID); roleErr == nil && redisRole != "" {
			role = redisRole
		}
	}

	client := ws.NewClient(
		clientID,
		claims.UserID,
		username,
		role,
		sessionID,
		conn,
		room,
		h.logger,
	)

	room.Register(client)

	h.logger.Info("authenticated websocket connection established",
		slog.String("clientId", clientID),
		slog.String("sessionId", sessionID),
		slog.String("userId", claims.UserID),
		slog.String("role", role),
	)

	// 7. Запуск насосов чтения и записи
	clientCtx, clientCancel := context.WithCancel(r.Context())
	defer clientCancel()

	go client.WritePump(clientCtx)
	client.ReadPump(clientCtx)
}
