package ws

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
	"golang.org/x/time/rate"
)

const (
	// writeWait - максимальное время ожидания записи сообщения в сокет.
	writeWait = 5 * time.Second

	// pingPeriod - интервал отправки ping-кадров для проверки живости соединения (Heartbeat).
	pingPeriod = 30 * time.Second

	// pongWait - максимальный таймаут ожидания подтверждения ping.
	pongWait = 5 * time.Second

	// clientSendBufferSize - размер буфера канала исходящих сообщений.
	clientSendBufferSize = 256

	// maxMessageSize - максимальный размер входящего WebSocket сообщения (1MB).
	maxMessageSize = 1024 * 1024

	// rateLimit - разрешенная средняя частота входящих сообщений от клиента (сообщений в секунду).
	rateLimit = 60

	// rateBurst - допустимый кратковременный всплеск входящих сообщений.
	rateBurst = 120

	// maxChatMessageLength - максимальная длина сообщения чата (защита от UI Freeze DOS).
	maxChatMessageLength = 4000

	// maxCodeContentLength - максимальный размер исходного кода в одном обновлении (500KB).
	maxCodeContentLength = 500 * 1024

	// maxFilePathLength - максимальная длина пути к файлу.
	maxFilePathLength = 255
)

// Client представляет единичное WebSocket-подключение пользователя к сессии.
type Client struct {
	ID        string
	UserID    string
	Username  string
	Role      string
	SessionID string

	conn      *websocket.Conn
	room      *Room
	sendCh    chan []byte
	doneCh    chan struct{}
	closeOnce sync.Once
	logger    *slog.Logger
	limiter   *rate.Limiter
}

// NewClient создает нового клиента WebSocket.
func NewClient(
	id string,
	userID string,
	username string,
	role string,
	sessionID string,
	conn *websocket.Conn,
	room *Room,
	logger *slog.Logger,
) *Client {
	if role == "" {
		role = "participant"
	}
	if username == "" {
		username = "User-" + userID
	}

	return &Client{
		ID:        id,
		UserID:    userID,
		Username:  username,
		Role:      role,
		SessionID: sessionID,
		conn:      conn,
		room:      room,
		sendCh:    make(chan []byte, clientSendBufferSize),
		doneCh:    make(chan struct{}),
		limiter:   rate.NewLimiter(rate.Limit(rateLimit), rateBurst),
		logger: logger.With(
			slog.String("clientId", id),
			slog.String("userId", userID),
			slog.String("sessionId", sessionID),
		),
	}
}

// ReadPump читает входящие сообщения из сокета и передает их в комнату.
func (c *Client) ReadPump(ctx context.Context) {
	defer func() {
		c.room.Unregister(c)
		c.Close(websocket.StatusNormalClosure, "connection closed")
	}()

	c.conn.SetReadLimit(maxMessageSize)

	for {
		select {
		case <-ctx.Done():
			return
		case <-c.doneCh:
			return
		default:
			msgType, data, err := c.conn.Read(ctx)
			if err != nil {
				if errors.Is(err, context.Canceled) || websocket.CloseStatus(err) == websocket.StatusNormalClosure || websocket.CloseStatus(err) == websocket.StatusGoingAway {
					c.logger.Debug("client connection closed normally")
				} else {
					c.logger.Warn("read error from websocket", slog.String("error", err.Error()))
				}
				return
			}

			if msgType != websocket.MessageText {
				c.logger.Warn("unsupported message type received, ignoring", slog.Int("type", int(msgType)))
				continue
			}

			c.handleIncomingMessage(data)
		}
	}
}

// WritePump слушает канал sendCh и отправляет сообщения в WebSocket соединение, а также шлет периодический Ping (Heartbeat).
func (c *Client) WritePump(ctx context.Context) {
	pingTicker := time.NewTicker(pingPeriod)
	defer pingTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-c.doneCh:
			return
		case <-pingTicker.C:
			// Отправка ping-кадра с таймаутом
			pingCtx, cancel := context.WithTimeout(ctx, pongWait)
			err := c.conn.Ping(pingCtx)
			cancel()

			if err != nil {
				c.logger.Warn("heartbeat ping failed, terminating stale connection", slog.String("error", err.Error()))
				c.Close(websocket.StatusGoingAway, "heartbeat timeout")
				return
			}
		case msg, ok := <-c.sendCh:
			if !ok {
				// Канал закрыт
				return
			}

			writeCtx, cancel := context.WithTimeout(ctx, writeWait)
			err := c.conn.Write(writeCtx, websocket.MessageText, msg)
			cancel()

			if err != nil {
				c.logger.Warn("write error to websocket", slog.String("error", err.Error()))
				c.Close(websocket.StatusInternalError, "write failure")
				return
			}
		}
	}
}

// handleIncomingMessage валидирует лимиты частоты, проверяет конверт и передает в комнату.
func (c *Client) handleIncomingMessage(data []byte) {
	// 1. Rate Limiting: проверка лимита частоты входящих сообщений
	if !c.limiter.Allow() {
		c.logger.Warn("rate limit exceeded, dropping message")
		if errResp, buildErr := NewSystemErrorEnvelope(c.SessionID, "", "RATE_LIMIT_EXCEEDED", "too many messages, please slow down", ""); buildErr == nil {
			c.Send(errResp)
		}
		return
	}

	// 2. Валидация конверта
	raw, err := ParseRawEnvelope(data)
	if err != nil {
		c.logger.Warn("invalid envelope received", slog.String("error", err.Error()))
		if errResp, buildErr := NewSystemErrorEnvelope(c.SessionID, "", "INVALID_PAYLOAD", "invalid message envelope structure", ""); buildErr == nil {
			c.Send(errResp)
		}
		return
	}

	// 3. Защита: клиент может отправлять события только в свою сессию
	if raw.SessionID != c.SessionID {
		c.logger.Warn("sessionId mismatch in payload",
			slog.String("expected", c.SessionID),
			slog.String("received", raw.SessionID),
		)
		if errResp, buildErr := NewSystemErrorEnvelope(c.SessionID, raw.RequestID, "SESSION_MISMATCH", "session id does not match connection context", ""); buildErr == nil {
			c.Send(errResp)
		}
		return
	}

	// 4. Обработка ping/pong на уровне протокола
	if raw.Type == EventSystemPing {
		pongEnv := NewEnvelope(EventSystemPong, c.SessionID, raw.RequestID, struct{}{})
		if pongBytes, marshalErr := pongEnv.ToBytes(); marshalErr == nil {
			c.Send(pongBytes)
		}
		return
	}

	// 5. Санитизация и валидация полезной нагрузки (защита от спуфинга и переполнения)
	sanitizedData, err := c.sanitizeIncomingPayload(raw)
	if err != nil {
		c.logger.Warn("payload validation/sanitization failed", slog.String("error", err.Error()))
		if errResp, buildErr := NewSystemErrorEnvelope(c.SessionID, raw.RequestID, "INVALID_PAYLOAD", err.Error(), ""); buildErr == nil {
			c.Send(errResp)
		}
		return
	}

	// 6. Широковещание остальным участникам комнаты
	c.room.Broadcast(sanitizedData, c.ID)
}

// sanitizeIncomingPayload принудительно подставляет проверенные UserID и Username в события и проверяет границы полей.
func (c *Client) sanitizeIncomingPayload(raw RawEnvelope) ([]byte, error) {
	switch raw.Type {
	case EventCursorMove:
		payload, err := UnpackPayload[CursorPayload](raw)
		if err != nil {
			return nil, err
		}
		payload.UserID = c.UserID
		payload.Username = c.Username

		// Защита от выхода за границы и переполнения координат курсора
		if payload.Line < 1 {
			payload.Line = 1
		}
		if payload.Column < 1 {
			payload.Column = 1
		}
		if payload.Line > 1000000 {
			payload.Line = 1000000
		}
		if payload.Column > 10000 {
			payload.Column = 10000
		}

		env := NewEnvelope(raw.Type, c.SessionID, raw.RequestID, payload)
		return env.ToBytes()

	case EventChatMessage:
		payload, err := UnpackPayload[ChatMessagePayload](raw)
		if err != nil {
			return nil, err
		}
		payload.SenderID = c.UserID
		payload.SenderName = c.Username

		trimmed := strings.TrimSpace(payload.Text)
		if trimmed == "" {
			return nil, errors.New("chat message cannot be empty")
		}

		// Обрезаем слишком длинные сообщения для защиты от UI Freeze DOS
		if len(payload.Text) > maxChatMessageLength {
			payload.Text = payload.Text[:maxChatMessageLength]
		}

		payload.SentAt = time.Now().UTC()
		env := NewEnvelope(raw.Type, c.SessionID, raw.RequestID, payload)
		return env.ToBytes()

	case EventCodeUpdate:
		payload, err := UnpackPayload[CodeUpdatePayload](raw)
		if err != nil {
			return nil, err
		}

		// Валидация пути к файлу (защита от Path Traversal)
		if len(payload.FilePath) > maxFilePathLength || strings.Contains(payload.FilePath, "..") {
			return nil, errors.New("invalid file path in code update")
		}

		// Ограничение максимального размера исходного кода (500KB)
		if len(payload.Content) > maxCodeContentLength {
			return nil, errors.New("code content exceeds maximum allowed size (500KB)")
		}

		env := NewEnvelope(raw.Type, c.SessionID, raw.RequestID, payload)
		return env.ToBytes()

	case EventMediaStateUpdate:
		payload, err := UnpackPayload[MediaStatePayload](raw)
		if err != nil {
			return nil, err
		}
		payload.UserID = c.UserID
		env := NewEnvelope(raw.Type, c.SessionID, raw.RequestID, payload)
		return env.ToBytes()

	case EventMediaSpeaker:
		payload, err := UnpackPayload[MediaSpeakerPayload](raw)
		if err != nil {
			return nil, err
		}
		payload.UserID = c.UserID
		env := NewEnvelope(raw.Type, c.SessionID, raw.RequestID, payload)
		return env.ToBytes()

	case EventAISuggestion:
		payload, err := UnpackPayload[AISuggestionPayload](raw)
		if err != nil {
			return nil, err
		}
		env := NewEnvelope(raw.Type, c.SessionID, raw.RequestID, payload)
		return env.ToBytes()

	default:
		// Для остальных системных событий
		return json.Marshal(raw)
	}
}

// Send безопасно помещает сообщение в канал отправки.
func (c *Client) Send(msg []byte) bool {
	select {
	case <-c.doneCh:
		return false
	case c.sendCh <- msg:
		return true
	default:
		c.logger.Warn("client send buffer full, dropping message")
		return false
	}
}

// Close потокобезопасно завершает работу клиента и закрывает сокет.
func (c *Client) Close(code websocket.StatusCode, reason string) {
	c.closeOnce.Do(func() {
		close(c.doneCh)
		close(c.sendCh)

		// Закрываем соединение с кодом
		if c.conn != nil {
			_ = c.conn.Close(code, reason)
		}
		c.logger.Debug("client closed", slog.Int("code", int(code)), slog.String("reason", reason))
	})
}
