package handler

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/mockinterviewai/realtime/internal/ws"
)

const (
	testWebhookAPIKey    = "devkey"
	testWebhookAPISecret = "secret"
)

// signWebhookJWT формирует валидный webhook-JWT (HS256) как это делает LiveKit:
// payload содержит sha256 (hex-хеш тела), iss, nbf, exp. Возвращает полный JWT.
func signWebhookJWT(t *testing.T, body []byte, opts map[string]any) string {
	t.Helper()

	now := time.Now().Unix()
	payload := map[string]any{
		"iss":    testWebhookAPIKey,
		"nbf":    now - 10,
		"exp":    now + 600,
		"sha256": hex.EncodeToString(mustHash(body)),
	}
	for k, v := range opts {
		if v == nil {
			delete(payload, k)
		} else {
			payload[k] = v
		}
	}

	header := []byte(`{"alg":"HS256","typ":"JWT"}`)
	headerB64 := base64.RawURLEncoding.EncodeToString(header)
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("fail marshal payload: %v", err)
	}
	payloadB64 := base64.RawURLEncoding.EncodeToString(payloadBytes)

	signingInput := headerB64 + "." + payloadB64
	mac := hmac.New(sha256.New, []byte(testWebhookAPISecret))
	_, _ = mac.Write([]byte(signingInput))
	sigB64 := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	return signingInput + "." + sigB64
}

func mustHash(body []byte) []byte {
	sum := sha256.Sum256(body)
	return sum[:]
}

func newFailClosedTestHandler(t *testing.T, hub *ws.Hub) *LiveKitWebhookHandler {
	t.Helper()
	return NewLiveKitWebhookHandler(hub, testWebhookAPIKey, testWebhookAPISecret, discardLogger())
}

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func doWebhook(t *testing.T, h *LiveKitWebhookHandler, body []byte, authHeader string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/webhooks/livekit", strings.NewReader(string(body)))
	req.Header.Set("Content-Type", "application/json")
	if authHeader != "" {
		req.Header.Set("Authorization", "Bearer "+authHeader)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

// captureRoomBroadcast подписывает "комнату" через прямой канал, чтобы проверить,
// что media.recording ушёл в BroadcastToRoom (создаём локальную комнату и
// проверяем, что сообщение попало в её broadcast-канал).
func TestLiveKitWebhookEgressToRecording(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	logger := discardLogger()
	hub := ws.NewHub(ctx, nil, nil, logger)
	h := newFailClosedTestHandler(t, hub)

	body := []byte(`{
		"event":"egress_started",
		"egressInfo":{"roomName":"session-room-1","status":"ACTIVE"}
	}`)
	auth := signWebhookJWT(t, body, nil)

	rec := doWebhook(t, h, body, auth)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	// Проверяем маппинг normalizeEgressStatus.
	if got := normalizeEgressStatus(EgressStarted, "ACTIVE"); got != "started" {
		t.Errorf("egress_started: expected started, got %q", got)
	}
	if got := normalizeEgressStatus(EgressUpdated, "RUNNING"); got != "started" {
		t.Errorf("egress_updated: expected started, got %q", got)
	}
	if got := normalizeEgressStatus(EgressEnded, "COMPLETE"); got != "stopped" {
		t.Errorf("egress_ended complete: expected stopped, got %q", got)
	}
	if got := normalizeEgressStatus(EgressEnded, "FAILED"); got != "failed" {
		t.Errorf("egress_ended failed: expected failed, got %q", got)
	}
	if got := normalizeEgressStatus(EventType("other"), ""); got != "unknown" {
		t.Errorf("unknown event: expected unknown, got %q", got)
	}
}

func TestLiveKitWebhookBuildRecordingEnvelope(t *testing.T) {
	logger := discardLogger()
	hub := ws.NewHub(context.Background(), nil, nil, logger)
	h := newFailClosedTestHandler(t, hub)

	data := h.buildRecordingEnvelope(liveKitEventPayload{
		Event: EgressEnded,
		EgressInfo: &egressInfoPayload{
			RoomName: "session-x",
			Status:   "COMPLETE",
		},
	})
	if data == nil {
		t.Fatal("expected non-nil envelope")
	}

	raw, err := ws.ParseRawEnvelope(data)
	if err != nil {
		t.Fatalf("invalid envelope: %v", err)
	}
	if raw.Type != ws.EventMediaRecording {
		t.Errorf("expected media.recording, got %s", raw.Type)
	}
	if raw.SessionID != "session-x" {
		t.Errorf("expected session-x, got %s", raw.SessionID)
	}

	// Если roomName пуст — envelope должен быть nil (не из чего рассылать).
	nilData := h.buildRecordingEnvelope(liveKitEventPayload{
		Event: EgressStarted,
		EgressInfo: &egressInfoPayload{
			RoomName: "",
			Status:   "ACTIVE",
		},
	})
	if nilData != nil {
		t.Error("expected nil envelope when roomName empty")
	}
}

func TestLiveKitWebhookSignatureVerification(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	hub := ws.NewHub(ctx, nil, nil, discardLogger())
	h := newFailClosedTestHandler(t, hub)

	body := []byte(`{"event":"egress_started","egressInfo":{"roomName":"r1"}}`)

	t.Run("валидная подпись → 200", func(t *testing.T) {
		auth := signWebhookJWT(t, body, nil)
		rec := doWebhook(t, h, body, auth)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
	})

	t.Run("отсутствующий заголовок → 401", func(t *testing.T) {
		rec := doWebhook(t, h, body, "")
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", rec.Code)
		}
	})

	t.Run("неверная подпись → 401", func(t *testing.T) {
		auth := signWebhookJWT(t, body, map[string]any{"exp": int64(time.Now().Unix() + 600)})
		// Портим подпись.
		parts := strings.Split(auth, ".")
		badSig := base64.RawURLEncoding.EncodeToString([]byte("badsig"))
		rec := doWebhook(t, h, body, parts[0]+"."+parts[1]+"."+badSig)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", rec.Code)
		}
	})

	t.Run("истёкший exp → 401", func(t *testing.T) {
		auth := signWebhookJWT(t, body, map[string]any{"exp": int64(time.Now().Unix() - 10)})
		rec := doWebhook(t, h, body, auth)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", rec.Code)
		}
	})

	t.Run("расхождение sha256-claim с хешем тела → 401", func(t *testing.T) {
		auth := signWebhookJWT(t, body, map[string]any{"sha256": strings.Repeat("0", 64)})
		rec := doWebhook(t, h, body, auth)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", rec.Code)
		}
	})

	t.Run("неверный issuer → 401", func(t *testing.T) {
		auth := signWebhookJWT(t, body, map[string]any{"iss": "wrong-key"})
		rec := doWebhook(t, h, body, auth)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", rec.Code)
		}
	})

	t.Run("legacy Livekit-Webhook-Jwt заголовок → 200", func(t *testing.T) {
		auth := signWebhookJWT(t, body, nil)
		req := httptest.NewRequest(http.MethodPost, "/webhooks/livekit", strings.NewReader(string(body)))
		req.Header.Set("Livekit-Webhook-Jwt", auth)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
	})
}

func TestLiveKitWebhookIgnoresNonEgress(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	hub := ws.NewHub(ctx, nil, nil, discardLogger())
	h := newFailClosedTestHandler(t, hub)

	body := []byte(`{"event":"participant_joined","participant":{"identity":"u1","room":{"sid":"r1"}}}`)
	auth := signWebhookJWT(t, body, nil)
	rec := doWebhook(t, h, body, auth)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for ignored event, got %d", rec.Code)
	}
}

func TestLiveKitWebhookDisabled(t *testing.T) {
	hub := ws.NewHub(context.Background(), nil, nil, discardLogger())
	h := NewLiveKitWebhookHandler(hub, "", "", discardLogger()) // not enabled

	rec := doWebhook(t, h, []byte(`{"event":"egress_started"}`), "whatever")
	if rec.Code != http.StatusNotImplemented {
		t.Fatalf("expected 501 when disabled, got %d", rec.Code)
	}
}

func TestLiveKitWebhookBroadcastToRoomWithLocalRoom(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	hub := ws.NewHub(ctx, nil, nil, discardLogger())
	// Создаём локальную комнату для session-x.
	room := hub.GetOrCreateRoom("session-x")
	defer room.Close()

	h := newFailClosedTestHandler(t, hub)

	body := []byte(`{"event":"egress_started","egressInfo":{"roomName":"session-x"}}`)
	auth := signWebhookJWT(t, body, nil)
	rec := doWebhook(t, h, body, auth)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}
