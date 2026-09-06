package handler

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/coder/websocket"
	chi "github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/mockinterviewai/realtime/internal/auth"
	"github.com/mockinterviewai/realtime/internal/storage"
	"github.com/mockinterviewai/realtime/internal/ws"
)

// mirrorTouchTTL — TTL, на который продлевается Redis-зеркало сессии при каждом
// успешном подключении (соответствует дефолту SESSION_MIRROR_TTL_SECONDS=2h в API).
const mirrorTouchTTL = 2 * time.Hour

// WebSocketHandler управляет аутентификацией и апгрейдом соединений до WebSocket.
type WebSocketHandler struct {
	hub                 *ws.Hub
	tokenVerifier       *auth.TokenVerifier
	sessionStore        storage.SessionStore
	logger              *slog.Logger
	allowedOrigins      []string
	cookieName          string
	maxConnections      int
	maxRoomClients      int
	allowAccessFallback bool
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
	allowAccessFallback bool,
) *WebSocketHandler {
	if cookieName == "" {
		cookieName = "access_token"
	}
	return &WebSocketHandler{
		hub:                 hub,
		tokenVerifier:       tokenVerifier,
		sessionStore:        sessionStore,
		logger:              logger.With(slog.String("component", "websocket_handler")),
		allowedOrigins:      allowedOrigins,
		cookieName:          cookieName,
		maxConnections:      maxConnections,
		maxRoomClients:      maxRoomClients,
		allowAccessFallback: allowAccessFallback,
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

	// 1. Извлечение учётных данных в порядке приоритета (Phase C):
	//    subprotocol-тикет (`realtime,<ticket>`) → Authorization: Bearer → cookie.
	rawToken := auth.ExtractTicketFromProtocol(r.Header.Get("Sec-WebSocket-Protocol"))
	credential := "ticket"
	if rawToken == "" {
		rawToken = auth.ExtractTokenFromRequest(r, h.cookieName)
		if rawToken != "" {
			credential = "access"
		}
	}
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

	// 2. Ветвление по типу токена (Phase C).
	switch claims.Type {
	case "realtime":
		// 2a. Одноразовый тикет: атомарно потребляем (ConsumeTicket) и,
		//      если он уже был использован — отклоняем (replay-protection).
		if h.sessionStore != nil && claims.TokenID != "" {
			consumed, consumeErr := h.sessionStore.ConsumeTicket(r.Context(), claims.TokenID)
			if consumeErr == nil && !consumed {
				h.logger.Warn("websocket connection rejected: ticket already used",
					slog.String("userId", claims.UserID),
					slog.String("tokenId", claims.TokenID),
				)
				http.Error(w, "Unauthorized: ticket already used", http.StatusUnauthorized)
				return
			}
		}
		// Тикет жёстко привязан к комнате (sessionId в claims) — не разрешаем
		// перенос на другую сессию.
		if claims.SessionID != "" && claims.SessionID != sessionID {
			h.logger.Warn("websocket connection rejected: ticket bound to another session",
				slog.String("sessionId", sessionID),
				slog.String("ticketSessionId", claims.SessionID),
			)
			http.Error(w, "Forbidden: ticket bound to another session", http.StatusForbidden)
			return
		}
		// Тикет не проверяется через IsTokenRevoked: одноразовость обеспечивается
		// ConsumeTicket, а TTL тикета короткий (5m).

	case "access":
		// 2b. Access-токен — только как временный fallback (P9). При выключенном
		//     флаге REALTIME_ALLOW_ACCESS_FALLBACK доступ по access-токену закрыт.
		if !h.allowAccessFallback {
			h.logger.Warn("websocket connection rejected: access-token fallback disabled",
				slog.String("sessionId", sessionID),
				slog.String("userId", claims.UserID),
			)
			http.Error(w, "Forbidden: access-token fallback is disabled", http.StatusForbidden)
			return
		}
		// Проверка отзыва access-токена в Redis (multi-use, поэтому критична).
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
	}

	// 2c. Проверка живой auth-сессии (fail-closed, Phase B): токен (любого типа)
	//     должен ссылаться на активную auth:session:{sid}; иначе → 401.
	if h.sessionStore != nil && claims.SID != "" {
		authActive, authErr := h.sessionStore.IsAuthSessionActive(r.Context(), claims.SID)
		if authErr != nil || !authActive {
			h.logger.Warn("websocket connection rejected: auth session is not active",
				slog.String("sessionId", sessionID),
				slog.String("sid", claims.SID),
			)
			http.Error(w, "Unauthorized: auth session is not active", http.StatusUnauthorized)
			return
		}
	}

	// 3. Проверка активности интервью-сессии (fail-closed, Phase B2):
	//    отсутствие ключа / ошибка / disabled ⇒ закрыто → 403.
	if h.sessionStore != nil {
		active, checkErr := h.sessionStore.IsSessionActive(r.Context(), sessionID)
		if checkErr != nil || !active {
			h.logger.Warn("websocket connection rejected: session is closed",
				slog.String("sessionId", sessionID),
				slog.Bool("active", active),
			)
			http.Error(w, "Forbidden: session is closed", http.StatusForbidden)
			return
		}
	}

	// 4. Проверка членства участника в сессии (fail-closed, Phase B2):
	//    роль берётся строго из хранилища; отсутствие роли ⇒ не участник → 403.
	role := ""
	if h.sessionStore != nil {
		storeRole, roleErr := h.sessionStore.GetSessionUserRole(r.Context(), sessionID, claims.UserID)
		if roleErr != nil || storeRole == "" {
			h.logger.Warn("websocket connection rejected: user is not a member of this session",
				slog.String("sessionId", sessionID),
				slog.String("userId", claims.UserID),
			)
			http.Error(w, "Forbidden: not a member of this session", http.StatusForbidden)
			return
		}
		role = storeRole
	}

	// Продлеваем TTL зеркала при успешном подключении (молчаливое интервью
	// дольше TTL не теряет доступ к реконнектам, P).
	if h.sessionStore != nil {
		_ = h.sessionStore.TouchMirror(r.Context(), sessionID, mirrorTouchTTL)
	}

	// 5. Настройка параметров апгрейда
	opts := &websocket.AcceptOptions{
		OriginPatterns: h.allowedOrigins,
		Subprotocols:   []string{"realtime"},
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
		slog.String("credential", credential),
	)

	// 7. Запуск насосов чтения и записи
	clientCtx, clientCancel := context.WithCancel(r.Context())
	defer clientCancel()

	go client.WritePump(clientCtx)
	client.ReadPump(clientCtx)
}
