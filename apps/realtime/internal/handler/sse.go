package handler

import (
	"errors"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/mockinterviewai/realtime/internal/auth"
	"github.com/mockinterviewai/realtime/internal/sse"
	"github.com/mockinterviewai/realtime/internal/storage"
)

const (
	// sseWriteTimeout — предельное время записи одного кадра в сокет клиента.
	sseWriteTimeout = 10 * time.Second

	// sseRetryAfterSeconds — подсказка клиенту в заголовке Retry-After при 429.
	sseRetryAfterSeconds = 30
)

// SSEHandler обслуживает глобальный поток персональных уведомлений пользователя.
type SSEHandler struct {
	hub            *sse.Hub
	tokenVerifier  *auth.TokenVerifier
	sessionStore   storage.SessionStore
	notifications  storage.NotificationStore
	logger         *slog.Logger
	cookieName     string
	trustProxyAddr bool
}

// NewSSEHandler создает обработчик SSE-потока уведомлений.
func NewSSEHandler(
	hub *sse.Hub,
	tokenVerifier *auth.TokenVerifier,
	sessionStore storage.SessionStore,
	notifications storage.NotificationStore,
	logger *slog.Logger,
	cookieName string,
	trustProxyAddr bool,
) *SSEHandler {
	if cookieName == "" {
		cookieName = "access_token"
	}

	return &SSEHandler{
		hub:            hub,
		tokenVerifier:  tokenVerifier,
		sessionStore:   sessionStore,
		notifications:  notifications,
		logger:         logger.With(slog.String("component", "sse_handler")),
		cookieName:     cookieName,
		trustProxyAddr: trustProxyAddr,
	}
}

// HandleNotifications обслуживает GET /sse/notifications — долгоживущий
// однонаправленный поток уведомлений с гарантией доставки at-least-once.
func (h *SSEHandler) HandleNotifications(w http.ResponseWriter, r *http.Request) {
	metrics := h.hub.Metrics()

	// 1. Запрет передачи токенов в query string: они утекают в access-логи
	// балансировщиков, историю браузера и заголовок Referer.
	query := r.URL.Query()
	if query.Has("token") || query.Has("access_token") {
		metrics.IncConnections(sse.ConnStatusRejected)
		http.Error(w, "Bad Request: authentication token must not be passed in query string", http.StatusBadRequest)
		return
	}

	// 2. Аутентификация по HttpOnly Cookie или заголовку Authorization: Bearer.
	rawToken := auth.ExtractTokenFromRequest(r, h.cookieName)
	if rawToken == "" {
		metrics.IncConnections(sse.ConnStatusRejected)
		http.Error(w, "Unauthorized: missing authentication token", http.StatusUnauthorized)
		return
	}

	claims, err := h.tokenVerifier.VerifyToken(rawToken)
	if err != nil {
		metrics.IncConnections(sse.ConnStatusRejected)
		h.logger.Warn("sse connection rejected: invalid auth token",
			slog.String("error", err.Error()),
		)
		http.Error(w, "Unauthorized: invalid or expired token", http.StatusUnauthorized)
		return
	}

	// 3. Проверка отзыва токена (blacklist в Redis).
	if h.sessionStore != nil && claims.TokenID != "" {
		if revoked, checkErr := h.sessionStore.IsTokenRevoked(r.Context(), claims.TokenID); checkErr == nil && revoked {
			metrics.IncConnections(sse.ConnStatusRejected)
			h.logger.Warn("sse connection rejected: token has been revoked",
				slog.String("userId", claims.UserID),
				slog.String("tokenId", claims.TokenID),
			)
			http.Error(w, "Unauthorized: token is revoked", http.StatusUnauthorized)
			return
		}
	}

	// 4. Стриминг невозможен без поддержки сброса буфера ответа.
	if _, ok := w.(http.Flusher); !ok {
		metrics.IncConnections(sse.ConnStatusRejected)
		h.logger.Error("sse streaming is not supported by the response writer")
		http.Error(w, "Internal Server Error: streaming unsupported", http.StatusInternalServerError)
		return
	}

	// 5. Резервирование слота с учетом лимитов на пользователя и на IP.
	// Клиент регистрируется до отправки заголовков, поэтому отказ еще можно
	// вернуть кодом 429, а события, пришедшие во время фазы Replay, уже буферизуются.
	options := h.hub.Options()
	client := sse.NewClient(
		uuid.NewString(),
		claims.UserID,
		h.clientIP(r),
		options.ClientBufferSize,
		options.SlowConsumerGrace,
		metrics,
		h.logger,
	)

	if regErr := h.hub.Register(r.Context(), client); regErr != nil {
		metrics.IncConnections(sse.ConnStatusRejected)
		h.rejectRegistration(w, claims.UserID, regErr)
		return
	}
	defer h.hub.Unregister(client)

	stream := newSSEStream(w, options.RetryMs)

	// 6. Заголовки долгоживущего потока. X-Accel-Buffering отключает буферизацию
	// в Nginx для конкретного ответа, если директива proxy_buffering не выключена глобально.
	header := w.Header()
	header.Set("Content-Type", "text/event-stream; charset=utf-8")
	header.Set("Cache-Control", "no-cache, no-store, no-transform, must-revalidate")
	header.Set("Connection", "keep-alive")
	header.Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)

	// Таймауты сервера рассчитаны на короткие запросы: для потока их нужно снять,
	// иначе ReadTimeout отменит контекст запроса, а WriteTimeout оборвет ответ.
	stream.disableServerTimeouts(h.logger)

	if err := stream.writeFrame(sse.RetryFrame(options.RetryMs)); err != nil {
		return
	}

	if err := stream.writeFrame(sse.CommentFrame("connected " + client.ID)); err != nil {
		return
	}

	h.logger.Info("sse stream opened",
		slog.String("sseClientId", client.ID),
		slog.String("userId", claims.UserID),
	)

	// 7. Фаза Replay: добираем события, пропущенные за время оффлайна.
	lastReplayedID := h.replayMissedEvents(r, client, stream, options.ReplayCount)

	// 8. Фаза Live Streaming.
	h.streamLoop(r, client, stream, lastReplayedID, options.HeartbeatInterval)
}

// rejectRegistration возвращает корректный HTTP-статус на отказ в регистрации соединения.
func (h *SSEHandler) rejectRegistration(w http.ResponseWriter, userID string, err error) {
	switch {
	case errors.Is(err, sse.ErrUserConnectionLimit), errors.Is(err, sse.ErrIPConnectionLimit):
		h.logger.Warn("sse connection rejected: connection limit reached",
			slog.String("userId", userID),
			slog.String("error", err.Error()),
		)
		w.Header().Set("Retry-After", strconv.Itoa(sseRetryAfterSeconds))
		http.Error(w, "Too Many Requests: sse connection limit reached", http.StatusTooManyRequests)
	case errors.Is(err, sse.ErrHubClosed):
		w.Header().Set("Retry-After", strconv.Itoa(sseRetryAfterSeconds))
		http.Error(w, "Service Unavailable: server is shutting down", http.StatusServiceUnavailable)
	default:
		h.logger.Error("failed to register sse client",
			slog.String("userId", userID),
			slog.String("error", err.Error()),
		)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}

// replayMissedEvents отдает клиенту события, появившиеся после Last-Event-ID,
// и возвращает ID последнего доставленного события.
func (h *SSEHandler) replayMissedEvents(
	r *http.Request,
	client *sse.Client,
	stream *sseStream,
	replayCount int64,
) string {
	lastEventID := strings.TrimSpace(r.Header.Get("Last-Event-ID"))
	if lastEventID == "" || h.notifications == nil {
		return ""
	}

	// Значение заголовка полностью контролируется клиентом и уходит в аргументы
	// XRANGE, поэтому принимаются только корректные Redis Stream ID.
	if !sse.IsValidStreamID(lastEventID) {
		h.logger.Warn("ignoring malformed Last-Event-ID header",
			slog.String("userId", client.UserID),
		)
		return ""
	}

	events, err := h.notifications.ReadHistory(r.Context(), client.UserID, lastEventID, replayCount)
	if err != nil {
		h.logger.Warn("failed to replay missed notifications",
			slog.String("userId", client.UserID),
			slog.String("lastEventId", lastEventID),
			slog.String("error", err.Error()),
		)
		return lastEventID
	}

	replayedID := lastEventID
	metrics := h.hub.Metrics()

	for i := range events {
		env := sse.EnvelopeFromStreamEvent(events[i])
		if writeErr := stream.writeEnvelope(env); writeErr != nil {
			return replayedID
		}

		replayedID = events[i].ID
		metrics.IncDispatched(env.Type.String())
	}

	if len(events) > 0 {
		h.logger.Info("replayed missed notifications",
			slog.String("userId", client.UserID),
			slog.String("lastEventId", lastEventID),
			slog.Int("count", len(events)),
		)
	}

	return replayedID
}

// streamLoop доставляет живые события и heartbeat-комментарии до разрыва соединения.
func (h *SSEHandler) streamLoop(
	r *http.Request,
	client *sse.Client,
	stream *sseStream,
	lastReplayedID string,
	heartbeat time.Duration,
) {
	ticker := time.NewTicker(heartbeat)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			h.logger.Info("sse stream closed by client",
				slog.String("sseClientId", client.ID),
				slog.String("userId", client.UserID),
			)
			return

		case <-client.Done():
			// Дописываем уже накопленные кадры (в частности финальный
			// auth.revoked) и закрываем поток.
			h.drain(client, stream, lastReplayedID)
			h.logger.Info("sse stream closed by server",
				slog.String("sseClientId", client.ID),
				slog.String("userId", client.UserID),
				slog.String("reason", client.CloseReason()),
			)
			return

		case env := <-client.Events():
			if skipReplayed(env, lastReplayedID) {
				continue
			}

			if err := stream.writeEnvelope(env); err != nil {
				return
			}

		case <-ticker.C:
			ping := "ping " + strconv.FormatInt(time.Now().UTC().UnixMilli(), 10)
			if err := stream.writeFrame(sse.CommentFrame(ping)); err != nil {
				return
			}
		}
	}
}

// drain дописывает оставшиеся в буфере события перед закрытием потока.
func (h *SSEHandler) drain(client *sse.Client, stream *sseStream, lastReplayedID string) {
	for {
		select {
		case env := <-client.Events():
			if skipReplayed(env, lastReplayedID) {
				continue
			}

			if err := stream.writeEnvelope(env); err != nil {
				return
			}
		default:
			return
		}
	}
}

// skipReplayed отсеивает события, уже отданные клиенту в фазе Replay.
// Клиент регистрируется до начала Replay, поэтому одно и то же событие может
// прийти и из истории, и из живой подписки.
func skipReplayed(env *sse.Envelope, lastReplayedID string) bool {
	if env == nil {
		return true
	}

	if env.ID == "" || lastReplayedID == "" {
		return false
	}

	return sse.CompareStreamIDs(env.ID, lastReplayedID) <= 0
}

// clientIP определяет адрес клиента для лимита соединений с одного IP.
// Заголовки прокси учитываются только при явно включенном доверии к ним:
// иначе клиент мог бы обойти лимит, подделав X-Forwarded-For.
func (h *SSEHandler) clientIP(r *http.Request) string {
	if h.trustProxyAddr {
		if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
			first, _, _ := strings.Cut(forwarded, ",")
			if ip := strings.TrimSpace(first); ip != "" {
				return ip
			}
		}

		if realIP := strings.TrimSpace(r.Header.Get("X-Real-IP")); realIP != "" {
			return realIP
		}
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}

	return host
}

// sseStream инкапсулирует запись SSE-кадров в HTTP-ответ со сбросом буфера.
type sseStream struct {
	writer  http.ResponseWriter
	control *http.ResponseController
	retryMs int
}

func newSSEStream(w http.ResponseWriter, retryMs int) *sseStream {
	return &sseStream{
		writer:  w,
		control: http.NewResponseController(w),
		retryMs: retryMs,
	}
}

// disableServerTimeouts снимает с соединения общие таймауты HTTP-сервера.
//
// http.Server.ReadTimeout выставляет дедлайн чтения сокета: по его истечении
// фоновое чтение net/http отменяет контекст запроса и обрывает живой поток,
// даже если клиент ничего не присылает. WriteTimeout аналогично ограничивает
// весь ответ целиком, поэтому дедлайн выставляется отдельно на каждый кадр.
func (s *sseStream) disableServerTimeouts(logger *slog.Logger) {
	if err := s.control.SetReadDeadline(time.Time{}); err != nil {
		logger.Debug("failed to clear sse read deadline", slog.String("error", err.Error()))
	}

	if err := s.control.SetWriteDeadline(time.Time{}); err != nil {
		logger.Debug("failed to clear sse write deadline", slog.String("error", err.Error()))
	}
}

// writeFrame записывает готовый кадр и немедленно сбрасывает его клиенту.
func (s *sseStream) writeFrame(frame []byte) error {
	_ = s.control.SetWriteDeadline(time.Now().Add(sseWriteTimeout))

	if _, err := s.writer.Write(frame); err != nil {
		return err
	}

	return s.control.Flush()
}

// writeEnvelope сериализует конверт в wire-кадр SSE и отправляет его клиенту.
func (s *sseStream) writeEnvelope(env *sse.Envelope) error {
	return s.writeFrame(env.Frame(s.retryMs))
}
