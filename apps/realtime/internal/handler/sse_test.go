package handler

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
	"github.com/mockinterviewai/realtime/internal/auth"
	"github.com/mockinterviewai/realtime/internal/sse"
	"github.com/mockinterviewai/realtime/internal/storage"
)

const testJWTSecret = "sse-handler-test-secret"

// fakeStore реализует storage.SessionStore и storage.NotificationStore,
// позволяя проверить SSE-эндпоинт без реального Redis.
type fakeStore struct {
	live chan storage.StreamEvent

	mu      sync.Mutex
	history []storage.StreamEvent
	revoked map[string]bool
}

func newFakeStore() *fakeStore {
	return &fakeStore{
		live:    make(chan storage.StreamEvent, 16),
		revoked: make(map[string]bool),
	}
}

func (f *fakeStore) seed(events ...storage.StreamEvent) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.history = append(f.history, events...)
}

func (f *fakeStore) IsTokenRevoked(_ context.Context, tokenID string) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	return f.revoked[tokenID], nil
}

func (f *fakeStore) IsSessionActive(context.Context, string) (bool, error) { return true, nil }

func (f *fakeStore) GetSessionUserRole(context.Context, string, string) (string, error) {
	return "candidate", nil
}

func (f *fakeStore) SaveCodeState(context.Context, string, []byte) error { return nil }

func (f *fakeStore) GetCodeState(context.Context, string) ([]byte, error) { return nil, nil }

func (f *fakeStore) Ping(context.Context) error { return nil }

func (f *fakeStore) Close() error { return nil }

func (f *fakeStore) PublishNotification(_ context.Context, _, eventType string, payload []byte) (string, error) {
	event := storage.StreamEvent{ID: "2-0", Type: eventType, Payload: payload}
	f.live <- event

	return event.ID, nil
}

// ReadHistory повторяет семантику XRANGE: возвращает не больше count событий,
// строго новее afterID. Ограничение по count здесь принципиально — без него
// тест постраничного добора истории проходил бы даже с одностраничным Replay.
func (f *fakeStore) ReadHistory(_ context.Context, _, afterID string, count int64) ([]storage.StreamEvent, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if count <= 0 {
		count = 20
	}

	missed := make([]storage.StreamEvent, 0, count)
	for _, event := range f.history {
		if sse.CompareStreamIDs(event.ID, afterID) <= 0 {
			continue
		}

		missed = append(missed, event)

		if int64(len(missed)) == count {
			break
		}
	}

	return missed, nil
}

func (f *fakeStore) ReadStream(
	ctx context.Context,
	_, _ string,
	_ int64,
	block time.Duration,
) ([]storage.StreamEvent, error) {
	timer := time.NewTimer(block)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-timer.C:
		return nil, nil
	case event := <-f.live:
		return []storage.StreamEvent{event}, nil
	}
}

func (f *fakeStore) LastStreamID(context.Context, string) (string, error) { return "0-0", nil }

func (f *fakeStore) PublishBroadcast(context.Context, string, []byte) error { return nil }

func (f *fakeStore) SubscribeBroadcast(context.Context, func(storage.BroadcastMessage)) (func(), error) {
	return func() {}, nil
}

func (f *fakeStore) IncrUserConnections(context.Context, string) (int64, error) { return 0, nil }

func (f *fakeStore) DecrUserConnections(context.Context, string) error { return nil }

func (f *fakeStore) Enabled() bool { return true }

// newTestToken выпускает валидный access-токен для тестового пользователя.
func newTestToken(t *testing.T, userID string) string {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, &auth.UserClaims{
		UserID:   userID,
		Username: "tester",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	})

	signed, err := token.SignedString([]byte(testJWTSecret))
	if err != nil {
		t.Fatalf("failed to sign test token: %v", err)
	}

	return signed
}

// newSSETestServer поднимает изолированный HTTP-сервер с маршрутом /sse/notifications.
func newSSETestServer(t *testing.T, store *fakeStore, opts sse.Options) *httptest.Server {
	t.Helper()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	hub := sse.NewHub(context.Background(), store, nil, opts, "test-node", logger)

	handler := NewSSEHandler(
		hub,
		auth.NewTokenVerifier(testJWTSecret),
		store,
		store,
		logger,
		"access_token",
		false,
	)

	mux := http.NewServeMux()
	mux.HandleFunc("/sse/notifications", handler.HandleNotifications)

	server := httptest.NewServer(mux)
	t.Cleanup(func() {
		server.Close()
		_ = hub.Close()
	})

	return server
}

// sseFrame — распарсенный кадр SSE.
type sseFrame struct {
	Event string
	ID    string
	Data  string
}

// readFrames читает поток и отправляет распарсенные кадры в канал, пропуская комментарии.
func readFrames(body io.Reader) <-chan sseFrame {
	frames := make(chan sseFrame, 16)

	go func() {
		defer close(frames)

		scanner := bufio.NewScanner(body)
		current := sseFrame{}

		for scanner.Scan() {
			line := scanner.Text()

			switch {
			case line == "":
				if current.Event != "" {
					frames <- current
				}
				current = sseFrame{}
			case strings.HasPrefix(line, ":"):
				continue
			case strings.HasPrefix(line, "event: "):
				current.Event = strings.TrimPrefix(line, "event: ")
			case strings.HasPrefix(line, "id: "):
				current.ID = strings.TrimPrefix(line, "id: ")
			case strings.HasPrefix(line, "data: "):
				current.Data += strings.TrimPrefix(line, "data: ")
			}
		}
	}()

	return frames
}

func awaitFrame(t *testing.T, frames <-chan sseFrame) sseFrame {
	t.Helper()

	select {
	case frame, ok := <-frames:
		if !ok {
			t.Fatal("sse stream closed before a frame was received")
		}
		return frame
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for an sse frame")
		return sseFrame{}
	}
}

func TestSSERejectsTokenInQueryString(t *testing.T) {
	server := newSSETestServer(t, newFakeStore(), sse.Options{})

	resp, err := http.Get(server.URL + "/sse/notifications?token=" + newTestToken(t, "user-1"))
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400 for a token in the query string, got %d", resp.StatusCode)
	}
}

func TestSSERequiresAuthentication(t *testing.T) {
	server := newSSETestServer(t, newFakeStore(), sse.Options{})

	resp, err := http.Get(server.URL + "/sse/notifications")
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401 without a token, got %d", resp.StatusCode)
	}
}

func TestSSEStreamsReplayThenLiveEvents(t *testing.T) {
	store := newFakeStore()
	store.seed(storage.StreamEvent{
		ID:      "1-0",
		Type:    "notification.new",
		Payload: []byte(`{"id":"missed-while-offline"}`),
	})

	server := newSSETestServer(t, store, sse.Options{
		HeartbeatInterval:   50 * time.Millisecond,
		StreamBlockInterval: 50 * time.Millisecond,
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, server.URL+"/sse/notifications", http.NoBody)
	if err != nil {
		t.Fatalf("failed to build request: %v", err)
	}

	req.AddCookie(&http.Cookie{Name: "access_token", Value: newTestToken(t, "user-1")})
	req.Header.Set("Last-Event-ID", "0-0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	if contentType := resp.Header.Get("Content-Type"); !strings.HasPrefix(contentType, "text/event-stream") {
		t.Errorf("unexpected content type: %q", contentType)
	}

	if buffering := resp.Header.Get("X-Accel-Buffering"); buffering != "no" {
		t.Errorf("proxy buffering must be disabled, got %q", buffering)
	}

	frames := readFrames(resp.Body)

	// 1. Фаза Replay: событие, пропущенное за время оффлайна.
	replayed := awaitFrame(t, frames)
	if replayed.Event != "notification.new" || replayed.ID != "1-0" {
		t.Fatalf("unexpected replayed frame: %+v", replayed)
	}

	var replayedEnvelope struct {
		ID      string          `json:"id"`
		Type    string          `json:"type"`
		Payload json.RawMessage `json:"payload"`
	}

	if err := json.Unmarshal([]byte(replayed.Data), &replayedEnvelope); err != nil {
		t.Fatalf("replayed frame must carry a valid envelope: %v", err)
	}

	if replayedEnvelope.ID != "1-0" || replayedEnvelope.Type != "notification.new" {
		t.Errorf("unexpected replayed envelope: %+v", replayedEnvelope)
	}

	// 2. Фаза Live Streaming: событие, опубликованное после подключения.
	if _, err := store.PublishNotification(ctx, "user-1", "ai.report_ready", []byte(`{"reportId":"r1"}`)); err != nil {
		t.Fatalf("failed to publish live notification: %v", err)
	}

	live := awaitFrame(t, frames)
	if live.Event != "ai.report_ready" || live.ID != "2-0" {
		t.Fatalf("unexpected live frame: %+v", live)
	}
}

func TestSSERejectsConnectionsOverUserLimit(t *testing.T) {
	store := newFakeStore()
	server := newSSETestServer(t, store, sse.Options{
		MaxConnectionsPerUser: 1,
		HeartbeatInterval:     50 * time.Millisecond,
		StreamBlockInterval:   50 * time.Millisecond,
	})

	token := newTestToken(t, "user-1")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	first, err := http.NewRequestWithContext(ctx, http.MethodGet, server.URL+"/sse/notifications", http.NoBody)
	if err != nil {
		t.Fatalf("failed to build request: %v", err)
	}
	first.AddCookie(&http.Cookie{Name: "access_token", Value: token})

	firstResp, err := http.DefaultClient.Do(first)
	if err != nil {
		t.Fatalf("first request failed: %v", err)
	}
	defer func() { _ = firstResp.Body.Close() }()

	if firstResp.StatusCode != http.StatusOK {
		t.Fatalf("first stream must be accepted, got %d", firstResp.StatusCode)
	}

	// Ждем первый кадр, чтобы гарантировать регистрацию соединения в хабе.
	awaitComment(t, firstResp.Body)

	second, err := http.NewRequest(http.MethodGet, server.URL+"/sse/notifications", http.NoBody)
	if err != nil {
		t.Fatalf("failed to build request: %v", err)
	}
	second.AddCookie(&http.Cookie{Name: "access_token", Value: token})

	secondResp, err := http.DefaultClient.Do(second)
	if err != nil {
		t.Fatalf("second request failed: %v", err)
	}
	defer func() { _ = secondResp.Body.Close() }()

	if secondResp.StatusCode != http.StatusTooManyRequests {
		t.Errorf("expected 429 over the per-user limit, got %d", secondResp.StatusCode)
	}

	if retryAfter := secondResp.Header.Get("Retry-After"); retryAfter == "" {
		t.Error("429 response must carry a Retry-After hint")
	}
}

// awaitComment дожидается служебного комментария в начале потока.
func awaitComment(t *testing.T, body io.Reader) {
	t.Helper()

	done := make(chan struct{})

	go func() {
		defer close(done)

		scanner := bufio.NewScanner(body)
		for scanner.Scan() {
			if strings.HasPrefix(scanner.Text(), ":") {
				return
			}
		}
	}()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for the sse stream to open")
	}
}

// TestSSEReplayDrainsHistoryBeyondOnePage закрывает регрессию: живая подписка
// стартует с "$" (только события после подписки), поэтому Replay обязан
// вычитать историю до конца. Ранее отдавалась ровно одна страница XRANGE, и
// все пропущенное сверх SSE_REPLAY_COUNT терялось молча до следующего
// переподключения клиента.
func TestSSEReplayDrainsHistoryBeyondOnePage(t *testing.T) {
	const (
		pageSize = 5
		missed   = 23
	)

	store := newFakeStore()
	for i := 1; i <= missed; i++ {
		store.seed(storage.StreamEvent{
			ID:      strconv.Itoa(i+1) + "-0",
			Type:    "notification.new",
			Payload: []byte(`{"n":` + strconv.Itoa(i) + `}`),
		})
	}

	server := newSSETestServer(t, store, sse.Options{ReplayCount: pageSize})

	req, err := http.NewRequest(http.MethodGet, server.URL+"/sse/notifications", nil)
	if err != nil {
		t.Fatalf("failed to build request: %v", err)
	}

	req.Header.Set("Authorization", "Bearer "+newTestToken(t, "user-replay"))
	req.Header.Set("Last-Event-ID", "1-0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	frames := readFrames(resp.Body)

	for i := 1; i <= missed; i++ {
		frame := awaitFrame(t, frames)

		wantID := strconv.Itoa(i+1) + "-0"
		if frame.ID != wantID {
			t.Fatalf("event %d: expected id %q, got %q", i, wantID, frame.ID)
		}

		if !strings.Contains(frame.Data, `"n":`+strconv.Itoa(i)) {
			t.Fatalf("event %d: unexpected payload %q", i, frame.Data)
		}
	}
}
