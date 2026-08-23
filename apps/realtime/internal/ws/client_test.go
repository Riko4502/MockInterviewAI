package ws

import (
	"encoding/json"
	"io"
	"log/slog"
	"strings"
	"testing"
	"time"

	"golang.org/x/time/rate"
)

func TestClientRateLimiting(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	room := NewRoom("test-session", nil, nil, logger, nil)

	client := &Client{
		ID:        "test-client-1",
		UserID:    "user-1",
		Username:  "Tester",
		Role:      "candidate",
		SessionID: "test-session",
		room:      room,
		sendCh:    make(chan []byte, 10),
		doneCh:    make(chan struct{}),
		limiter:   rate.NewLimiter(rate.Limit(5), 5), // Лимит 5 сообщений
		logger:    logger,
	}

	rawValidEnv := `{"type":"cursor.move","version":1,"sessionId":"test-session","requestId":"r1","payload":{"userId":"user-1","line":1,"column":1}}`

	// Первые 5 запросов должны пройти
	for i := 0; i < 5; i++ {
		client.handleIncomingMessage([]byte(rawValidEnv))
	}

	// 6-й запрос должен превысить лимит и отправить ошибку RATE_LIMIT_EXCEEDED
	client.handleIncomingMessage([]byte(rawValidEnv))

	select {
	case errMsg := <-client.sendCh:
		var env RawEnvelope
		if err := json.Unmarshal(errMsg, &env); err != nil {
			t.Fatalf("failed to unmarshal error envelope: %v", err)
		}
		if env.Type != EventSystemError {
			t.Errorf("expected %s, got %s", EventSystemError, env.Type)
		}
		errPayload, err := UnpackPayload[SystemErrorPayload](env)
		if err != nil {
			t.Fatalf("failed to unpack system error: %v", err)
		}
		if errPayload.Code != "RATE_LIMIT_EXCEEDED" {
			t.Errorf("expected RATE_LIMIT_EXCEEDED, got %s", errPayload.Code)
		}
	case <-time.After(500 * time.Millisecond):
		t.Error("expected rate limit error message in sendCh, but received nothing")
	}
}

func TestClientPayloadSanitization(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	client := &Client{
		ID:        "client-1",
		UserID:    "authenticated-user-id",
		Username:  "RealAlice",
		SessionID: "session-1",
		logger:    logger,
	}

	// Клиент пытается отправить поддельный UserID/Username
	fakePayload := `{"type":"cursor.move","version":1,"sessionId":"session-1","requestId":"r1","payload":{"userId":"fake-admin-id","username":"FakeAdmin","line":10,"column":20}}`

	var raw RawEnvelope
	if err := json.Unmarshal([]byte(fakePayload), &raw); err != nil {
		t.Fatalf("failed to unmarshal fake payload: %v", err)
	}

	sanitizedBytes, err := client.sanitizeIncomingPayload(raw)
	if err != nil {
		t.Fatalf("failed to sanitize payload: %v", err)
	}

	rawSanitized, err := ParseRawEnvelope(sanitizedBytes)
	if err != nil {
		t.Fatalf("failed to parse sanitized envelope: %v", err)
	}

	unpacked, err := UnpackPayload[CursorPayload](rawSanitized)
	if err != nil {
		t.Fatalf("failed to unpack sanitized cursor: %v", err)
	}

	// Должны быть подставлены настоящие UserID и Username
	if unpacked.UserID != "authenticated-user-id" || unpacked.Username != "RealAlice" {
		t.Errorf("expected authenticated identity, got userId=%s, username=%s", unpacked.UserID, unpacked.Username)
	}
}

func TestClientPayloadBoundaryLimits(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	client := &Client{
		ID:        "client-1",
		UserID:    "user-1",
		Username:  "Alice",
		SessionID: "session-1",
		logger:    logger,
	}

	// 1. Отрицательные координаты курсора должны корректироваться до 1
	negCursorPayload := `{"type":"cursor.move","version":1,"sessionId":"session-1","payload":{"userId":"user-1","line":-5,"column":-10}}`

	var rawCur RawEnvelope
	if err := json.Unmarshal([]byte(negCursorPayload), &rawCur); err != nil {
		t.Fatalf("failed to unmarshal cursor envelope: %v", err)
	}

	sanitizedCurBytes, err := client.sanitizeIncomingPayload(rawCur)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	rawCurSanitized, err := ParseRawEnvelope(sanitizedCurBytes)
	if err != nil {
		t.Fatalf("failed to parse sanitized cursor envelope: %v", err)
	}

	unpackedCur, err := UnpackPayload[CursorPayload](rawCurSanitized)
	if err != nil {
		t.Fatalf("failed to unpack sanitized cursor payload: %v", err)
	}

	if unpackedCur.Line != 1 || unpackedCur.Column != 1 {
		t.Errorf(
			"expected coordinates to be clamped to (1,1), got (%d, %d)",
			unpackedCur.Line,
			unpackedCur.Column,
		)
	}

	// 2. Слишком длинное сообщение чата должно обрезаться до 4000 символов
	hugeText := strings.Repeat("A", 5000)

	rawChatBytes, err := NewEnvelope(
		EventChatMessage,
		"session-1",
		"req-chat-1",
		ChatMessagePayload{
			Text: hugeText,
		},
	).ToBytes()
	if err != nil {
		t.Fatalf("failed to serialize chat envelope: %v", err)
	}

	var rawChat RawEnvelope
	if err := json.Unmarshal(rawChatBytes, &rawChat); err != nil {
		t.Fatalf("failed to unmarshal chat envelope: %v", err)
	}

	sanitizedChatBytes, err := client.sanitizeIncomingPayload(rawChat)
	if err != nil {
		t.Fatalf("unexpected error on huge chat message: %v", err)
	}

	rawChatSanitized, err := ParseRawEnvelope(sanitizedChatBytes)
	if err != nil {
		t.Fatalf("failed to parse sanitized chat envelope: %v", err)
	}

	unpackedChat, err := UnpackPayload[ChatMessagePayload](rawChatSanitized)
	if err != nil {
		t.Fatalf("failed to unpack sanitized chat payload: %v", err)
	}

	if len(unpackedChat.Text) != 4000 {
		t.Errorf(
			"expected chat message to be truncated to 4000 characters, got %d",
			len(unpackedChat.Text),
		)
	}

	// 3. Попытка Path Traversal в пути к файлу должна отклоняться
	badCodePayload := `{"type":"code.update","version":1,"sessionId":"session-1","payload":{"filePath":"../../etc/passwd","language":"go","content":"package main"}}`

	var rawCode RawEnvelope
	if err := json.Unmarshal([]byte(badCodePayload), &rawCode); err != nil {
		t.Fatalf("failed to unmarshal code envelope: %v", err)
	}

	_, err = client.sanitizeIncomingPayload(rawCode)
	if err == nil {
		t.Error("expected error for path traversal in filePath, got nil")
	}
}
