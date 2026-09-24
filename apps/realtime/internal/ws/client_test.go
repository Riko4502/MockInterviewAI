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

func TestClientYjsPayloadValidation(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	client := &Client{
		ID:        "c-1",
		UserID:    "user-1",
		Username:  "Tester",
		SessionID: "session-1",
		logger:    logger,
	}

	validTaskKey := "task-1:typescript"
	validUpdateID := "c1:1"
	validData := "dGVzdC1kYXRh"

	// 1. Валидный yjs.update
	validUpdateEnv, _ := NewEnvelope(
		EventYjsUpdate,
		"session-1",
		"req-1",
		YjsUpdatePayload{
			TaskKey:  validTaskKey,
			UpdateID: validUpdateID,
			Data:     validData,
		},
	).ToBytes()

	raw, err := ParseRawEnvelope(validUpdateEnv)
	if err != nil {
		t.Fatalf("ParseRawEnvelope failed: %v", err)
	}

	sanitized, err := client.sanitizeIncomingPayload(raw)
	if err != nil {
		t.Fatalf("sanitizeIncomingPayload failed for valid yjs.update: %v", err)
	}
	if len(sanitized) == 0 {
		t.Fatal("expected non-empty sanitized bytes")
	}

	// 2. Отклонение пустого taskKey
	badKeyEnv, _ := NewEnvelope(
		EventYjsUpdate,
		"session-1",
		"req-2",
		YjsUpdatePayload{
			TaskKey:  "   ",
			UpdateID: validUpdateID,
			Data:     validData,
		},
	).ToBytes()
	raw, _ = ParseRawEnvelope(badKeyEnv)
	if _, err := client.sanitizeIncomingPayload(raw); err == nil {
		t.Error("expected error for empty taskKey, got nil")
	}

	// 3. Отклонение невалидного taskKey с path traversal
	badKeyEnv, _ = NewEnvelope(
		EventYjsUpdate,
		"session-1",
		"req-3",
		YjsUpdatePayload{
			TaskKey:  "../task-1:typescript",
			UpdateID: validUpdateID,
			Data:     validData,
		},
	).ToBytes()
	raw, _ = ParseRawEnvelope(badKeyEnv)
	if _, err := client.sanitizeIncomingPayload(raw); err == nil {
		t.Error("expected error for path traversal taskKey, got nil")
	}

	// 4. Отклонение пустого updateId
	badUpdateIDEnv, _ := NewEnvelope(
		EventYjsUpdate,
		"session-1",
		"req-4",
		YjsUpdatePayload{
			TaskKey:  validTaskKey,
			UpdateID: "",
			Data:     validData,
		},
	).ToBytes()
	raw, _ = ParseRawEnvelope(badUpdateIDEnv)
	if _, err := client.sanitizeIncomingPayload(raw); err == nil {
		t.Error("expected error for empty updateId, got nil")
	}

	// 5. Отклонение пустых данных data
	emptyDataEnv, _ := NewEnvelope(
		EventYjsUpdate,
		"session-1",
		"req-5",
		YjsUpdatePayload{
			TaskKey:  validTaskKey,
			UpdateID: validUpdateID,
			Data:     "",
		},
	).ToBytes()
	raw, _ = ParseRawEnvelope(emptyDataEnv)
	if _, err := client.sanitizeIncomingPayload(raw); err == nil {
		t.Error("expected error for empty data, got nil")
	}

	// 6. Отклонение данных, превышающих лимит 64 КБ (87384 символа)
	oversizedData := strings.Repeat("A", maxYjsBase64Length+1)
	oversizedEnv, _ := NewEnvelope(
		EventYjsUpdate,
		"session-1",
		"req-6",
		YjsUpdatePayload{
			TaskKey:  validTaskKey,
			UpdateID: validUpdateID,
			Data:     oversizedData,
		},
	).ToBytes()
	raw, _ = ParseRawEnvelope(oversizedEnv)
	if _, err := client.sanitizeIncomingPayload(raw); err == nil {
		t.Error("expected error for oversized yjs update data (> 64KB), got nil")
	}

	// 6a. Отклонение данных yjs.update, содержащих CR/LF
	crlfDataEnv, _ := NewEnvelope(
		EventYjsUpdate,
		"session-1",
		"req-6a",
		YjsUpdatePayload{
			TaskKey:  validTaskKey,
			UpdateID: validUpdateID,
			Data:     "AAA\r\nAAA=",
		},
	).ToBytes()
	raw, _ = ParseRawEnvelope(crlfDataEnv)
	if _, err := client.sanitizeIncomingPayload(raw); err == nil {
		t.Error("expected error for yjs update data containing CR/LF, got nil")
	}

	// 7. Валидный yjs.awareness
	awarenessEnv, _ := NewEnvelope(
		EventYjsAwareness,
		"session-1",
		"req-7",
		YjsAwarenessPayload{
			TaskKey: validTaskKey,
			Data:    validData,
		},
	).ToBytes()
	raw, _ = ParseRawEnvelope(awarenessEnv)
	if _, err := client.sanitizeIncomingPayload(raw); err != nil {
		t.Errorf("unexpected error for valid awareness: %v", err)
	}

	// 8. Отклонение yjs.awareness с данными > 16 КБ
	oversizedAwarenessEnv, _ := NewEnvelope(
		EventYjsAwareness,
		"session-1",
		"req-8",
		YjsAwarenessPayload{
			TaskKey: validTaskKey,
			Data:    oversizedData,
		},
	).ToBytes()
	raw, _ = ParseRawEnvelope(oversizedAwarenessEnv)
	if _, err := client.sanitizeIncomingPayload(raw); err == nil {
		t.Error("expected error for oversized awareness data, got nil")
	}

	// 8a. Отклонение данных yjs.awareness, содержащих CR/LF
	crlfAwarenessEnv, _ := NewEnvelope(
		EventYjsAwareness,
		"session-1",
		"req-8a",
		YjsAwarenessPayload{
			TaskKey: validTaskKey,
			Data:    "AAA\nAAA=",
		},
	).ToBytes()
	raw, _ = ParseRawEnvelope(crlfAwarenessEnv)
	if _, err := client.sanitizeIncomingPayload(raw); err == nil {
		t.Error("expected error for awareness data containing CR/LF, got nil")
	}

	// 9. Валидный task.switch
	switchEnv, _ := NewEnvelope(
		EventTaskSwitch,
		"session-1",
		"req-9",
		TaskSwitchPayload{
			TaskKey: "task-2:python",
		},
	).ToBytes()
	raw, _ = ParseRawEnvelope(switchEnv)
	if _, err := client.sanitizeIncomingPayload(raw); err != nil {
		t.Errorf("unexpected error for valid task.switch: %v", err)
	}
}

func TestClient_SanitizeIncomingPayload_YjsSnapshot(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	interviewer := NewClient("client-interviewer", "user-1", "Alice", "interviewer", "session-1", nil, nil, logger)
	candidate := NewClient("client-candidate", "user-2", "Bob", "candidate", "session-1", nil, nil, logger)
	observer := NewClient("client-observer", "user-3", "Charlie", "observer", "session-1", nil, nil, logger)

	// Валидный snapshot
	validEnv, _ := NewEnvelope(
		EventYjsSnapshot,
		"session-1",
		"req-snap-1",
		YjsSnapshotPayload{
			TaskKey:  "two-sum:typescript",
			Snapshot: "dGVzdA==",
		},
	).ToBytes()
	raw, err := ParseRawEnvelope(validEnv)
	if err != nil {
		t.Fatalf("failed to parse envelope: %v", err)
	}

	// 1. Интервьюер может успешно отправлять валидный снимок
	if _, err := interviewer.sanitizeIncomingPayload(raw); err != nil {
		t.Errorf("unexpected error for valid yjs.snapshot from interviewer: %v", err)
	}

	// 2. Кандидат не имеет права отправлять снимок (CWE-862)
	if _, err := candidate.sanitizeIncomingPayload(raw); err == nil {
		t.Errorf("expected authorization error for candidate sending yjs.snapshot, got nil")
	}

	// 3. Наблюдатель не имеет права отправлять снимок
	if _, err := observer.sanitizeIncomingPayload(raw); err == nil {
		t.Errorf("expected authorization error for observer sending yjs.snapshot, got nil")
	}

	// 4. Snapshot с CR/LF
	crlfEnv, _ := NewEnvelope(
		EventYjsSnapshot,
		"session-1",
		"req-snap-2",
		YjsSnapshotPayload{
			TaskKey:  "two-sum:typescript",
			Snapshot: "dGVz\r\ndA==",
		},
	).ToBytes()
	rawCRLF, _ := ParseRawEnvelope(crlfEnv)
	if _, err := interviewer.sanitizeIncomingPayload(rawCRLF); err == nil {
		t.Errorf("expected error for yjs.snapshot with CR/LF, got nil")
	}

	// 5. Пустой snapshot
	emptyEnv, _ := NewEnvelope(
		EventYjsSnapshot,
		"session-1",
		"req-snap-3",
		YjsSnapshotPayload{
			TaskKey:  "two-sum:typescript",
			Snapshot: "",
		},
	).ToBytes()
	rawEmpty, _ := ParseRawEnvelope(emptyEnv)
	if _, err := interviewer.sanitizeIncomingPayload(rawEmpty); err == nil {
		t.Errorf("expected error for empty snapshot, got nil")
	}

	// 6. Слишком короткий snapshot (< 2 байт после декодирования)
	tooShortEnv, _ := NewEnvelope(
		EventYjsSnapshot,
		"session-1",
		"req-snap-4",
		YjsSnapshotPayload{
			TaskKey:  "two-sum:typescript",
			Snapshot: "AQ==", // 1 байт (0x01)
		},
	).ToBytes()
	rawTooShort, _ := ParseRawEnvelope(tooShortEnv)
	if _, err := interviewer.sanitizeIncomingPayload(rawTooShort); err == nil {
		t.Errorf("expected error for too short snapshot data, got nil")
	}
}

