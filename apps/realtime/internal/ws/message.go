package ws

import (
	"time"
)

// EventType представляет строго типизированный тип события WebSocket.
type EventType string

const (
	// EventPresenceJoin события и синхронизация комнаты
	EventPresenceJoin  EventType = "presence.join"
	EventPresenceLeave EventType = "presence.leave"
	EventRoomSync      EventType = "room.sync"

	// EventCursorMove Редактор и курсор
	EventCursorMove EventType = "cursor.move"
	EventCodeUpdate EventType = "code.update"

	// EventChatMessage Чат и подсказки
	EventChatMessage  EventType = "chat.message"
	EventAISuggestion EventType = "ai.suggestion"

	// EventMediaStateUpdate LiveKit / WebRTC медиа-события
	EventMediaStateUpdate   EventType = "media.state_update"
	//nolint:gosec // Event name contains "token" but is not a credential.
	EventMediaTokenRequest  EventType = "media.token_request"
	//nolint:gosec // Event name contains "token" but is not a credential.
	EventMediaTokenResponse EventType = "media.token_response"
	EventMediaRecording     EventType = "media.recording"
	EventMediaSpeaker       EventType = "media.speaker"

	// EventSystemError Системные события
	EventSystemError EventType = "system.error"
	EventSystemAck   EventType = "system.ack"
	EventSystemPing  EventType = "system.ping"
	EventSystemPong  EventType = "system.pong"
)

// String возвращает строковое представление типа события.
func (e EventType) String() string {
	return string(e)
}

// ParticipantInfo содержит информацию об отдельном участнике комнаты.
type ParticipantInfo struct {
	UserID   string `json:"userId"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

// RoomSyncPayload отправляется новому клиенту сразу при входе, передавая снимок состояния комнаты.
type RoomSyncPayload struct {
	SessionID    string             `json:"sessionId"`
	Participants []ParticipantInfo  `json:"participants"`
	CodeState    *CodeUpdatePayload `json:"codeState,omitempty"`
}

// PresencePayload описывает вход/выход участника сессии.
type PresencePayload struct {
	UserID    string `json:"userId"`
	Username  string `json:"username"`
	Role      string `json:"role"`
	Color     string `json:"color,omitempty"`
	UserCount int    `json:"userCount,omitempty"`
}

// CursorPayload описывает положение курсора и выделение текста пользователем.
type CursorPayload struct {
	UserID         string `json:"userId"`
	Username       string `json:"username"`
	Line           int    `json:"line"`
	Column         int    `json:"column"`
	SelectionStart int    `json:"selectionStart,omitempty"`
	SelectionEnd   int    `json:"selectionEnd,omitempty"`
}

// CodeUpdatePayload описывает синхронизацию кода сессии.
type CodeUpdatePayload struct {
	FilePath string `json:"filePath"`
	Language string `json:"language"`
	Content  string `json:"content"`
	Delta    string `json:"delta,omitempty"`
	Version  int64  `json:"version"`
}

// ChatMessagePayload описывает сообщение в чате комнаты.
type ChatMessagePayload struct {
	MessageID  string    `json:"messageId"`
	SenderID   string    `json:"senderId"`
	SenderName string    `json:"senderName"`
	Text       string    `json:"text"`
	SentAt     time.Time `json:"sentAt"`
}

// AISuggestionPayload описывает наводящую подсказку от ИИ для участников интервью.
type AISuggestionPayload struct {
	SuggestionID   string `json:"suggestionId"`
	Prompt         string `json:"prompt"`
	Hint           string `json:"hint"`
	RemainingHints int    `json:"remainingHints"`
}

// MediaStatePayload описывает текущий статус микрофона, камеры и демонстрации экрана.
type MediaStatePayload struct {
	UserID        string `json:"userId"`
	IsMuted       bool   `json:"isMuted"`
	IsVideoOn     bool   `json:"isVideoOn"`
	IsScreenShare bool   `json:"isScreenShare"`
}

// MediaTokenRequestPayload описывает запрос клиента на получение LiveKit токена.
type MediaTokenRequestPayload struct {
	SessionID string `json:"sessionId"`
}

// MediaTokenResponsePayload возвращает токен для подключения к комнате LiveKit.
type MediaTokenResponsePayload struct {
	LiveKitURL string `json:"livekitUrl"`
	Token      string `json:"token"`
	RoomName   string `json:"roomName"`
}

// MediaRecordingPayload описывает статус записи видеозвонка (LiveKit Egress).
type MediaRecordingPayload struct {
	SessionID string `json:"sessionId"`
	Status    string `json:"status"` // "started", "stopped", "failed"
	RecordURL string `json:"recordUrl,omitempty"`
}

// MediaSpeakerPayload передает активного говорящего участника для UI индикации.
type MediaSpeakerPayload struct {
	UserID     string  `json:"userId"`
	IsSpeaking bool    `json:"isSpeaking"`
	AudioLevel float64 `json:"audioLevel,omitempty"`
}

// SystemErrorPayload описывает системную ошибку клиенту.
type SystemErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

// SystemAckPayload подтверждает получение или обработку запроса.
type SystemAckPayload struct {
	TargetRequestID string `json:"targetRequestId"`
	Status          string `json:"status"`
}
