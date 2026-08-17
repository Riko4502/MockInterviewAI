package ws

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// ProtocolVersion is the current WebSocket protocol version.
const ProtocolVersion = 1

var (
	// ErrEmptySessionID indicates that the session ID is missing.
	ErrEmptySessionID = errors.New("sessionId is required")
	// ErrEmptyType indicates that the event type is empty.
	ErrEmptyType      = errors.New("message type is required")
	// ErrInvalidVersion indicates that the event type is empty.
	ErrInvalidVersion = errors.New("unsupported protocol version")
)

// RawEnvelope представляет базовый формат конверта сообщений при чтении из WebSocket соединения.
type RawEnvelope struct {
	Type      EventType       `json:"type"`
	Version   int             `json:"version"`
	SessionID string          `json:"sessionId"`
	RequestID string          `json:"requestId"`
	Timestamp time.Time       `json:"timestamp"`
	Payload   json.RawMessage `json:"payload"`
}

// Validate проверяет обязательные поля входящего конверта.
func (e *RawEnvelope) Validate() error {
	if e.Type == "" {
		return ErrEmptyType
	}
	if e.SessionID == "" {
		return ErrEmptySessionID
	}
	if e.Version == 0 {
		e.Version = ProtocolVersion
	}
	if e.Timestamp.IsZero() {
		e.Timestamp = time.Now().UTC()
	}
	if e.RequestID == "" {
		e.RequestID = uuid.NewString()
	}
	return nil
}

// EventPayload строго ограничивает допустимые типы полезной нагрузки только структурами нашего WebSocket-протокола.
type EventPayload interface {
	PresencePayload |
		RoomSyncPayload |
		CursorPayload |
		CodeUpdatePayload |
		ChatMessagePayload |
		AISuggestionPayload |
		MediaStatePayload |
		MediaTokenRequestPayload |
		MediaTokenResponsePayload |
		MediaRecordingPayload |
		MediaSpeakerPayload |
		SystemErrorPayload |
		SystemAckPayload |
		struct{}
}

// Envelope представляет строго типизированный конверт с полезной нагрузкой типа T.
type Envelope[T EventPayload] struct {
	Type      EventType `json:"type"`
	Version   int       `json:"version"`
	SessionID string    `json:"sessionId"`
	RequestID string    `json:"requestId"`
	Timestamp time.Time `json:"timestamp"`
	Payload   T         `json:"payload"`
}

// NewEnvelope создает новый типизированный конверт.
func NewEnvelope[T EventPayload](eventType EventType, sessionID, requestID string, payload T) Envelope[T] {
	if requestID == "" {
		requestID = uuid.NewString()
	}
	return Envelope[T]{
		Type:      eventType,
		Version:   ProtocolVersion,
		SessionID: sessionID,
		RequestID: requestID,
		Timestamp: time.Now().UTC(),
		Payload:   payload,
	}
}

// ToBytes сериализует типизированный конверт в байты JSON.
func (e Envelope[T]) ToBytes() ([]byte, error) {
	data, err := json.Marshal(e)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal envelope: %w", err)
	}
	return data, nil
}

// ParseRawEnvelope разбирает сырые байты сообщения в RawEnvelope с валидацией.
func ParseRawEnvelope(data []byte) (RawEnvelope, error) {
	var env RawEnvelope
	if err := json.Unmarshal(data, &env); err != nil {
		return RawEnvelope{}, fmt.Errorf("invalid json envelope: %w", err)
	}
	if err := env.Validate(); err != nil {
		return RawEnvelope{}, err
	}
	return env, nil
}

// UnpackPayload распаковывает Payload из RawEnvelope в целевую типизированную структуру.
func UnpackPayload[T EventPayload](raw RawEnvelope) (T, error) {
	var target T
	if len(raw.Payload) == 0 {
		return target, nil
	}
	if err := json.Unmarshal(raw.Payload, &target); err != nil {
		return target, fmt.Errorf("failed to unmarshal payload for type %s: %w", raw.Type, err)
	}
	return target, nil
}

// NewSystemErrorEnvelope создает готовый к отправке конверт системной ошибки.
func NewSystemErrorEnvelope(sessionID, requestID, code, message, details string) ([]byte, error) {
	env := NewEnvelope(
		EventSystemError,
		sessionID,
		requestID,
		SystemErrorPayload{
			Code:    code,
			Message: message,
			Details: details,
		},
	)
	return env.ToBytes()
}

// NewSystemAckEnvelope создает готовый к отправке конверт подтверждения.
func NewSystemAckEnvelope(sessionID, requestID, targetRequestID, status string) ([]byte, error) {
	env := NewEnvelope(
		EventSystemAck,
		sessionID,
		requestID,
		SystemAckPayload{
			TargetRequestID: targetRequestID,
			Status:          status,
		},
	)
	return env.ToBytes()
}
