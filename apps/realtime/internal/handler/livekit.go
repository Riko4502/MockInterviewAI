package handler

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/mockinterviewai/realtime/internal/ws"
)

// LiveKitWebhookMaxBodyBytes ограничивает размер тела запроса webhook
// (защита от DoS oversize body).
const LiveKitWebhookMaxBodyBytes = 1 << 20 // 1 MiB

// LiveKitWebhookHandler обрабатывает входящие webhook-события от LiveKit SFU
// (POST /webhooks/livekit). Верифицирует подпись webhook-JWT (HS256 по webhook
// api secret) и сверяет sha256-claim с хешем тела, затем маппит события
// egress_* в бизнес-событие media.recording и рассылает в комнату сессии.
type LiveKitWebhookHandler struct {
	hub     *ws.Hub
	apiKey  string
	secret  string
	logger  *slog.Logger
	enabled bool
}

// NewLiveKitWebhookHandler создаёт обработчик LiveKit webhook.
// Если apiKey/secret пустые (не включено) — обработчик возвращает 501.
func NewLiveKitWebhookHandler(hub *ws.Hub, apiKey, secret string, logger *slog.Logger) *LiveKitWebhookHandler {
	return &LiveKitWebhookHandler{
		hub:     hub,
		apiKey:  apiKey,
		secret:  secret,
		logger:  logger.With(slog.String("component", "livekit_webhook")),
		enabled: apiKey != "" && secret != "",
	}
}

// EventType — тип webhook-события LiveKit.
type EventType string

// egress-события, которые продукт ретранслирует в media.recording.
const (
	EgressStarted EventType = "egress_started"
	EgressUpdated EventType = "egress_updated"
	EgressEnded   EventType = "egress_ended"
)

// egressInfoPayload — минимальное подмножество egressInfo, необходимое
// для бизнес-события media.recording (комната и status).
type egressInfoPayload struct {
	RoomName string `json:"roomName"`
	Status   string `json:"status"`
}

// liveKitEventPayload — тело webhook-события LiveKit.
type liveKitEventPayload struct {
	Event      EventType          `json:"event"`
	EgressInfo *egressInfoPayload `json:"egressInfo"`
}

// normalizeEgressStatus маппит статус egress-события в словарь media.recording
// (started / stopped / failed). Для egress_started и egress_updated — "started",
// для egress_ended — "stopped" (события failed приходят как egress_ended со
// status=failed, см. ниже). Спец: livekit egress_ended может нести status.
func normalizeEgressStatus(ev EventType, status string) string {
	switch ev {
	case EgressStarted, EgressUpdated:
		return "started"
	case EgressEnded:
		// status=failed приходит в egress_ended со status, отличным от COMPLETE.
		if s := strings.ToLower(strings.TrimSpace(status)); s == "failed" || s == "error" {
			return "failed"
		}
		return "stopped"
	default:
		return "unknown"
	}
}

// ServeHTTP обрабатывает POST /webhooks/livekit.
func (h *LiveKitWebhookHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !h.enabled {
		h.logger.Warn("livekit webhook is not configured")
		http.Error(w, "LiveKit webhook is not configured", http.StatusNotImplemented)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Ограничение размера тела (защита от oversize).
	r.Body = http.MaxBytesReader(w, r.Body, LiveKitWebhookMaxBodyBytes)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		h.logger.Warn("failed to read webhook body", slog.String("error", err.Error()))
		http.Error(w, "Failed to read body", http.StatusBadRequest)
		return
	}
	if len(body) == 0 {
		http.Error(w, "Empty body", http.StatusBadRequest)
		return
	}

	// 1. Верификация подписи webhook-JWT (HS256) + сверка sha256-claim с хешем тела.
	if !h.verifyWebhook(r, body) {
		h.logger.Warn("livekit webhook signature verification failed")
		http.Error(w, "Unauthorized: invalid webhook signature", http.StatusUnauthorized)
		return
	}

	// 2. Парсинг события.
	var event liveKitEventPayload
	if err := json.Unmarshal(body, &event); err != nil {
		h.logger.Warn("failed to parse webhook event", slog.String("error", err.Error()))
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// 3. Маппим только egress_* → media.recording. Остальные события игнорируются
	//    безопасно (200), т.к. LiveKit шлёт и tracking/participant/room события.
	if !isEgressEvent(event.Event) {
		h.logger.Debug("ignoring non-egress livekit webhook event", slog.String("event", string(event.Event)))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("{}"))
		return
	}

	broadcast := h.buildRecordingEnvelope(event)
	if broadcast == nil {
		h.logger.Debug("egress event missing roomName, skipping broadcast",
			slog.String("event", string(event.Event)))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("{}"))
		return
	}

	sessionID := event.EgressInfo.RoomName

	if !h.hub.BroadcastToRoom(sessionID, broadcast) {
		h.logger.Info("media.recording not delivered — no local room and no broadcaster",
			slog.String("sessionId", sessionID))
	}

	h.logger.Info("broadcast media.recording",
		slog.String("sessionId", sessionID),
		slog.String("event", string(event.Event)),
	)

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("{}"))
}

// isEgressEvent возвращает true, если событие относится к egress.
func isEgressEvent(ev EventType) bool {
	switch ev {
	case EgressStarted, EgressUpdated, EgressEnded:
		return true
	default:
		return false
	}
}

// buildRecordingEnvelope строит байты конверта media.recording для сессии.
// Возвращает nil, если комната egress пуста (не из какой комнаты рассылать).
func (h *LiveKitWebhookHandler) buildRecordingEnvelope(event liveKitEventPayload) []byte {
	if event.EgressInfo == nil || strings.TrimSpace(event.EgressInfo.RoomName) == "" {
		return nil
	}

	sessionID := event.EgressInfo.RoomName
	status := normalizeEgressStatus(event.Event, event.EgressInfo.Status)

	payload := ws.MediaRecordingPayload{
		SessionID: sessionID,
		Status:    status,
	}
	env := ws.NewEnvelope(
		ws.EventMediaRecording,
		sessionID,
		"",
		payload,
	)
	data, err := env.ToBytes()
	if err != nil {
		h.logger.Warn("failed to marshal media.recording envelope", slog.String("error", err.Error()))
		return nil
	}
	return data
}

// verifyWebhook проверяет подпись webhook-JWT и сверяет sha256-claim с хешем тела.
//
// LiveKit кладёт signed-JWT в заголовок Authorization (Bearer <jwt>) либо,
// для legacy-серверов, в Livekit-Webhook-Jwt. JWT подписан HS256 по webhook
// api secret, а payload содержит claim "sha256" — hex SHA-256 хеш тела.
// Проверка: (1) подпись валидна и iss совпадает с api key, (2) exp/nbf в окне,
// (3) claim "sha256" == hex(SHA-256(body)).
func (h *LiveKitWebhookHandler) verifyWebhook(r *http.Request, body []byte) bool {
	rawToken := extractWebhookToken(r)
	if rawToken == "" {
		return false
	}

	claims, ok := parseAndVerifyJWT(rawToken, h.apiKey, h.secret)
	if !ok {
		return false
	}

	// Сверка sha256-claim с хешем тела (привязка подписи к содержимому).
	claim, ok := claims["sha256"].(string)
	if !ok {
		return false
	}
	expected := sha256.Sum256(body)
	if !strings.EqualFold(strings.TrimSpace(claim), hex.EncodeToString(expected[:])) {
		return false
	}

	return true
}

// extractWebhookToken извлекает JWT из заголовков webhook-запроса.
// Приоритет: Authorization: Bearer <jwt> → Livekit-Webhook-Jwt (legacy).
func extractWebhookToken(r *http.Request) string {
	authz := strings.TrimSpace(r.Header.Get("Authorization"))
	if authz != "" {
		parts := strings.SplitN(authz, " ", 2)
		if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
			return strings.TrimSpace(parts[1])
		}
		// Authorization с самим токеном без Bearer.
		return authz
	}
	if legacy := strings.TrimSpace(r.Header.Get("Livekit-Webhook-Jwt")); legacy != "" {
		return legacy
	}
	return ""
}

// claims — декодированный payload JWT (claims).
type claims map[string]any

// parseAndVerifyJWT декодирует и верифицирует HS256 JWT вручную (stdlib):
// проверяет структуру (3 части, base64url без padding), декодирует payload,
// проверяет подпись через HMAC-SHA256, iss == apiKey и окно exp/nbf.
func parseAndVerifyJWT(rawToken, apiKey, secret string) (claims, bool) {
	parts := strings.Split(rawToken, ".")
	if len(parts) != 3 {
		return nil, false
	}

	headerB64, payloadB64, sigB64 := parts[0], parts[1], parts[2]

	// Декодирование payload.
	payloadJSON, err := base64.RawURLEncoding.DecodeString(payloadB64)
	if err != nil {
		return nil, false
	}
	var c claims
	if err := json.Unmarshal(payloadJSON, &c); err != nil {
		return nil, false
	}

	// 1. Проверка подписи: HMAC-SHA256(header.payload, secret) == sig.
	signingInput := headerB64 + "." + payloadB64
	sig, err := base64.RawURLEncoding.DecodeString(sigB64)
	if err != nil {
		return nil, false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(signingInput))
	if !hmac.Equal(sig, mac.Sum(nil)) {
		return nil, false
	}

	// 2. Проверка issuer (api key).
	if iss, ok := c["iss"].(string); !ok || iss != apiKey {
		return nil, false
	}

	// 3. Проверка окна времени (nbf/exp).
	now := time.Now().Unix()
	if nbf, ok := toInt64(c["nbf"]); ok && now < nbf {
		return nil, false
	}
	if exp, ok := toInt64(c["exp"]); ok && now >= exp {
		return nil, false
	}

	return c, true
}

// toInt64 безопасно конвертирует claim в int64 (json числа приходят как float64).
func toInt64(v any) (int64, bool) {
	switch n := v.(type) {
	case float64:
		return int64(n), true
	case json.Number:
		if i, err := n.Int64(); err == nil {
			return i, true
		}
	case int64:
		return n, true
	}
	return 0, false
}
