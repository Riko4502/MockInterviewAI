package ws

import (
	"encoding/json"
	"testing"
	"time"
)

func TestEnvelopeSerializationAndUnpacking(t *testing.T) {
	sessionID := "test-session-123"
	reqID := "req-456"

	// 1. Тест создания типизированного конверта для CursorPayload
	cursorPayload := CursorPayload{
		UserID:         "user-1",
		Username:       "Alice",
		Line:           12,
		Column:         5,
		SelectionStart: 10,
		SelectionEnd:   25,
	}

	env := NewEnvelope(EventCursorMove, sessionID, reqID, cursorPayload)
	if env.Type != EventCursorMove {
		t.Fatalf("expected type %s, got %s", EventCursorMove, env.Type)
	}

	bytes, err := env.ToBytes()
	if err != nil {
		t.Fatalf("failed to serialize envelope: %v", err)
	}

	// 2. Тест парсинга в RawEnvelope
	raw, err := ParseRawEnvelope(bytes)
	if err != nil {
		t.Fatalf("failed to parse raw envelope: %v", err)
	}

	if raw.SessionID != sessionID {
		t.Errorf("expected sessionID %s, got %s", sessionID, raw.SessionID)
	}
	if raw.RequestID != reqID {
		t.Errorf("expected requestID %s, got %s", reqID, raw.RequestID)
	}
	if raw.Type != EventCursorMove {
		t.Errorf("expected type %s, got %s", EventCursorMove, raw.Type)
	}

	// 3. Тест распаковки типизированного Payload
	unpacked, err := UnpackPayload[CursorPayload](raw)
	if err != nil {
		t.Fatalf("failed to unpack payload: %v", err)
	}

	if unpacked.UserID != "user-1" || unpacked.Line != 12 || unpacked.Column != 5 {
		t.Errorf("unpacked payload mismatch: %+v", unpacked)
	}
}

func TestCodeUpdateEnvelope(t *testing.T) {
	codePayload := CodeUpdatePayload{
		FilePath: "main.go",
		Language: "go",
		Content:  "package main\n\nfunc main() {}\n",
		Version:  1,
	}

	env := NewEnvelope(EventCodeUpdate, "session-code", "req-1", codePayload)
	bytes, err := env.ToBytes()
	if err != nil {
		t.Fatalf("failed to serialize code envelope: %v", err)
	}

	raw, err := ParseRawEnvelope(bytes)
	if err != nil {
		t.Fatalf("failed to parse: %v", err)
	}

	unpacked, err := UnpackPayload[CodeUpdatePayload](raw)
	if err != nil {
		t.Fatalf("failed to unpack: %v", err)
	}

	if unpacked.Content != codePayload.Content || unpacked.FilePath != "main.go" {
		t.Errorf("code payload mismatch: %+v", unpacked)
	}
}

func TestMediaEventsEnvelope(t *testing.T) {
	// 1. MediaStatePayload
	mediaState := MediaStatePayload{
		UserID:        "user-candidate",
		IsMuted:       false,
		IsVideoOn:     true,
		IsScreenShare: false,
	}

	env := NewEnvelope(EventMediaStateUpdate, "session-media", "req-m1", mediaState)
	bytes, err := env.ToBytes()
	if err != nil {
		t.Fatalf("failed to serialize media state envelope: %v", err)
	}

	raw, err := ParseRawEnvelope(bytes)
	if err != nil {
		t.Fatalf("failed to parse raw envelope: %v", err)
	}

	unpacked, err := UnpackPayload[MediaStatePayload](raw)
	if err != nil {
		t.Fatalf("failed to unpack media payload: %v", err)
	}

	if unpacked.UserID != "user-candidate" || !unpacked.IsVideoOn || unpacked.IsMuted {
		t.Errorf("media state mismatch: %+v", unpacked)
	}

	// 2. MediaTokenResponsePayload
	tokenResp := MediaTokenResponsePayload{
		LiveKitURL: "wss://livekit.example.com",
		Token:      "jwt-livekit-token",
		RoomName:   "session-media",
	}

	tokenEnv := NewEnvelope(EventMediaTokenResponse, "session-media", "req-m2", tokenResp)
	tokenBytes, err := tokenEnv.ToBytes()
	if err != nil {
		t.Fatalf("failed to serialize token envelope: %v", err)
	}

	rawToken, err := ParseRawEnvelope(tokenBytes)
	if err != nil {
		t.Fatalf("failed to parse token envelope: %v", err)
	}

	unpackedToken, err := UnpackPayload[MediaTokenResponsePayload](rawToken)
	if err != nil {
		t.Fatalf("failed to unpack token payload: %v", err)
	}

	if unpackedToken.LiveKitURL != "wss://livekit.example.com" || unpackedToken.Token != "jwt-livekit-token" {
		t.Errorf("token payload mismatch: %+v", unpackedToken)
	}
}

func TestInvalidRawEnvelope(t *testing.T) {
	// Невалидный JSON
	_, err := ParseRawEnvelope([]byte("invalid json"))
	if err == nil {
		t.Error("expected error for invalid json, got nil")
	}

	// Отсутствует type
	rawWithoutType := `{"sessionId":"s1","payload":{}}`
	_, err = ParseRawEnvelope([]byte(rawWithoutType))
	if err == nil {
		t.Error("expected error for missing type, got nil")
	}

	// Отсутствует sessionId
	rawWithoutSession := `{"type":"cursor.move","payload":{}}`
	_, err = ParseRawEnvelope([]byte(rawWithoutSession))
	if err == nil {
		t.Error("expected error for missing sessionId, got nil")
	}
}

func TestSystemErrorEnvelope(t *testing.T) {
	bytes, err := NewSystemErrorEnvelope("s1", "r1", "ERR_CODE", "Error text", "Details")
	if err != nil {
		t.Fatalf("failed to create system error envelope: %v", err)
	}

	var raw RawEnvelope
	if err := json.Unmarshal(bytes, &raw); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if raw.Type != EventSystemError {
		t.Errorf("expected %s, got %s", EventSystemError, raw.Type)
	}

	errPayload, err := UnpackPayload[SystemErrorPayload](raw)
	if err != nil {
		t.Fatalf("failed to unpack system error: %v", err)
	}

	if errPayload.Code != "ERR_CODE" || errPayload.Message != "Error text" {
		t.Errorf("unexpected error payload content: %+v", errPayload)
	}
}

func TestPresenceEnvelope(t *testing.T) {
	payload := PresencePayload{
		UserID:    "u-1",
		Username:  "Bob",
		Role:      "interviewer",
		Color:     "#3b82f6",
		UserCount: 2,
	}

	env := NewEnvelope(EventPresenceJoin, "s-presence", "", payload)
	bytes, err := env.ToBytes()
	if err != nil {
		t.Fatalf("failed to serialize: %v", err)
	}

	raw, err := ParseRawEnvelope(bytes)
	if err != nil {
		t.Fatalf("failed to parse: %v", err)
	}

	unpacked, err := UnpackPayload[PresencePayload](raw)
	if err != nil {
		t.Fatalf("failed to unpack: %v", err)
	}

	if unpacked.Username != "Bob" || unpacked.Role != "interviewer" || unpacked.UserCount != 2 {
		t.Errorf("unexpected presence payload: %+v", unpacked)
	}
}

func TestChatMessageEnvelope(t *testing.T) {
	now := time.Now().UTC()
	payload := ChatMessagePayload{
		MessageID:  "msg-1",
		SenderID:   "u-1",
		SenderName: "Alice",
		Text:       "Hello!",
		SentAt:     now,
	}

	env := NewEnvelope(EventChatMessage, "s-chat", "", payload)
	bytes, err := env.ToBytes()
	if err != nil {
		t.Fatalf("failed to serialize: %v", err)
	}

	raw, err := ParseRawEnvelope(bytes)
	if err != nil {
		t.Fatalf("failed to parse: %v", err)
	}

	unpacked, err := UnpackPayload[ChatMessagePayload](raw)
	if err != nil {
		t.Fatalf("failed to unpack: %v", err)
	}

	if unpacked.Text != "Hello!" || unpacked.SenderName != "Alice" {
		t.Errorf("unexpected chat message payload: %+v", unpacked)
	}
}

func TestRoomSyncEnvelope(t *testing.T) {
	participants := []ParticipantInfo{
		{UserID: "u-1", Username: "Alice", Role: "candidate"},
		{UserID: "u-2", Username: "Bob", Role: "interviewer"},
	}
	codeSnapshot := &CodeUpdatePayload{
		FilePath: "solution.go",
		Language: "go",
		Content:  "package main\n\nfunc Solve() int { return 42 }\n",
		Version:  3,
	}

	payload := RoomSyncPayload{
		SessionID:    "session-sync-1",
		Participants: participants,
		CodeState:    codeSnapshot,
	}

	env := NewEnvelope(EventRoomSync, "session-sync-1", "", payload)
	bytes, err := env.ToBytes()
	if err != nil {
		t.Fatalf("failed to serialize room sync envelope: %v", err)
	}

	raw, err := ParseRawEnvelope(bytes)
	if err != nil {
		t.Fatalf("failed to parse: %v", err)
	}

	unpacked, err := UnpackPayload[RoomSyncPayload](raw)
	if err != nil {
		t.Fatalf("failed to unpack: %v", err)
	}

	if len(unpacked.Participants) != 2 || unpacked.CodeState == nil || unpacked.CodeState.Content != codeSnapshot.Content {
		t.Errorf("unexpected room sync payload: %+v", unpacked)
	}
}
