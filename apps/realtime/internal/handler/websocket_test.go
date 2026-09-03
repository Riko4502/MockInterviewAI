package handler

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	chi "github.com/go-chi/chi/v5"
	jwt "github.com/golang-jwt/jwt/v5"
	"github.com/mockinterviewai/realtime/internal/auth"
	"github.com/mockinterviewai/realtime/internal/storage"
	"github.com/mockinterviewai/realtime/internal/ws"
)

// generateTestJWT создает подписанный JWT токен для тестов.
func generateTestJWT(secret, userID, username, sessionID string) (string, error) {
	now := time.Now().UTC()
	claims := auth.UserClaims{
		UserID:    userID,
		Username:  username,
		SessionID: sessionID,
		TokenID:   fmt.Sprintf("tok-%d", now.UnixNano()),
		Type:      "access",
		SID:       "sid-" + userID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			ID:        fmt.Sprintf("tok-%d", now.UnixNano()),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(1 * time.Hour)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// generateTestTicket создает одноразовый realtime-тикет (typ=="realtime")
// с привязкой к конкретной комнате через SessionID.
func generateTestTicket(secret, userID, username, sessionID string) (string, error) {
	now := time.Now().UTC()
	claims := auth.UserClaims{
		UserID:    userID,
		Username:  username,
		SessionID: sessionID,
		TokenID:   fmt.Sprintf("ticket-%d", now.UnixNano()),
		Type:      "realtime",
		SID:       "sid-" + userID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			ID:        fmt.Sprintf("ticket-%d", now.UnixNano()),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(5 * time.Minute)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// mockSessionStore — честная модель SessionStore для тестов (fail-closed).
type mockSessionStore struct {
	roles     map[string]string
	active    map[string]bool
	codeState map[string][]byte
	consumed  map[string]bool
}

func (m *mockSessionStore) IsTokenRevoked(_ context.Context, _ string) (bool, error) {
	return false, nil
}

// Fail-closed: активна только если явно true в карте, иначе closed.
func (m *mockSessionStore) IsSessionActive(_ context.Context, sessionID string) (bool, error) {
	if m.active == nil {
		return false, nil
	}
	return m.active[sessionID], nil
}

// Роль — строго из карты; отсутствие → ("", nil) = не участник.
func (m *mockSessionStore) GetSessionUserRole(_ context.Context, _ string, userID string) (string, error) {
	if role, ok := m.roles[userID]; ok {
		return role, nil
	}
	return "", nil
}

func (m *mockSessionStore) IsAuthSessionActive(_ context.Context, sid string) (bool, error) {
	return sid != "", nil
}

func (m *mockSessionStore) ConsumeTicket(_ context.Context, tokenID string) (bool, error) {
	if m.consumed[tokenID] {
		return false, nil
	}
	if m.consumed == nil {
		m.consumed = make(map[string]bool)
	}
	m.consumed[tokenID] = true
	return true, nil
}

func (m *mockSessionStore) TouchMirror(_ context.Context, _ string, _ time.Duration) error {
	return nil
}

func (m *mockSessionStore) SaveCodeState(_ context.Context, sessionID string, data []byte) error {
	if m.codeState == nil {
		m.codeState = make(map[string][]byte)
	}
	m.codeState[sessionID] = data
	return nil
}
func (m *mockSessionStore) GetCodeState(_ context.Context, sessionID string) ([]byte, error) {
	if m.codeState == nil {
		return nil, nil
	}
	return m.codeState[sessionID], nil
}
func (m *mockSessionStore) Ping(_ context.Context) error { return nil }
func (m *mockSessionStore) Close() error                 { return nil }

func dialWebSocket(
	ctx context.Context,
	url string,
	opts *websocket.DialOptions,
) (*websocket.Conn, error) {
	conn, resp, err := websocket.Dial(ctx, url, opts)

	if err != nil && resp != nil {
		_ = resp.Body.Close()
	}

	return conn, err
}

func TestE2EWebSocketSessionWorkflow(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Инициализация зависимостей сервера
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	secret := "integration-test-secret-key-12345"
	tokenVerifier := auth.NewTokenVerifier(secret)
	sessionStore := &mockSessionStore{
		roles: map[string]string{
			"cand-1": "candidate",
			"int-1":  "interviewer",
		},
		active:    map[string]bool{"interview-session-e2e": true},
		codeState: make(map[string][]byte),
	}
	hub := ws.NewHub(ctx, nil, sessionStore, logger)

	wsHandler := NewWebSocketHandler(hub, tokenVerifier, sessionStore, logger, []string{"*"}, "access_token", 10000, 20, true)

	r := chi.NewRouter()
	r.Get("/ws/sessions/{sessionId}", wsHandler.HandleSessionWS)

	ts := httptest.NewServer(r)
	defer ts.Close()

	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http")
	sessionID := "interview-session-e2e"

	// 2. Тест: Отклонение подключения без токена (401 Unauthorized)
	_, resp, err := websocket.Dial(ctx, wsURL+"/ws/sessions/"+sessionID, nil)

	if resp != nil {
		defer resp.Body.Close()
	}

	if err == nil {
		t.Fatal("expected dial without token to fail with 401, but succeeded")
	}

	// 3. Тест: Отклонение не-участника активной сессии (403 Forbidden, fail-closed)
	// intruder не входит в roles → нет роли → "not a member of this session".
	badToken, err := generateTestJWT(secret, "intruder", "Hacker", "other-session")
	if err != nil {
		t.Fatalf("failed to generate bad token: %v", err)
	}
	dialOptsBad := &websocket.DialOptions{
		HTTPHeader: http.Header{
			"Cookie": []string{"access_token=" + badToken},
		},
	}
	_, err = dialWebSocket(
		ctx,
		wsURL+"/ws/sessions/"+sessionID,
		dialOptsBad,
	)
	if err == nil {
		t.Fatal("expected dial by non-member to fail with 403, but succeeded")
	}

	// 4. Подключение Кандидата с токеном в Cookie (User A)
	candidateToken, err := generateTestJWT(secret, "cand-1", "Candidate-Alex", sessionID)
	if err != nil {
		t.Fatalf("failed to generate candidate token: %v", err)
	}

	dialOptsCandidate := &websocket.DialOptions{
		HTTPHeader: http.Header{
			"Cookie": []string{"access_token=" + candidateToken},
		},
	}

	connCandidate, err := dialWebSocket(
		ctx,
		wsURL+"/ws/sessions/"+sessionID,
		dialOptsCandidate,
	)
	if err != nil {
		t.Fatalf("candidate failed to connect via websocket: %v", err)
	}
	defer connCandidate.Close(websocket.StatusNormalClosure, "test end")

	// Кандидат должен сразу получить снимок комнаты (room.sync)
	_, msgCandidate1, err := connCandidate.Read(ctx)
	if err != nil {
		t.Fatalf("candidate failed to read room.sync: %v", err)
	}
	rawSync1, err := ws.ParseRawEnvelope(msgCandidate1)
	if err != nil {
		t.Fatalf("candidate failed to parse room.sync envelope: %v", err)
	}
	if rawSync1.Type != ws.EventRoomSync {
		t.Fatalf("expected first event to be %s, got %s", ws.EventRoomSync, rawSync1.Type)
	}

	// 5. Подключение Собеседующего с токеном в Cookie (User B)
	interviewerToken, err := generateTestJWT(secret, "int-1", "Interviewer-Sarah", sessionID)
	if err != nil {
		t.Fatalf("failed to generate interviewer token: %v", err)
	}

	dialOptsInterviewer := &websocket.DialOptions{
		HTTPHeader: http.Header{
			"Cookie": []string{"access_token=" + interviewerToken},
		},
	}

	connInterviewer, err := dialWebSocket(
		ctx,
		wsURL+"/ws/sessions/"+sessionID,
		dialOptsInterviewer,
	)
	if err != nil {
		t.Fatalf("interviewer failed to connect via websocket: %v", err)
	}
	defer connInterviewer.Close(websocket.StatusNormalClosure, "test end")

	// Собеседующий получает свой room.sync со списком всех участников (кандидат + собеседующий)
	_, msgInterviewerSync, err := connInterviewer.Read(ctx)
	if err != nil {
		t.Fatalf("interviewer failed to read room.sync: %v", err)
	}
	rawSync2, err := ws.ParseRawEnvelope(msgInterviewerSync)
	if err != nil {
		t.Fatalf("interviewer failed to parse room.sync: %v", err)
	}
	syncPayload2, err := ws.UnpackPayload[ws.RoomSyncPayload](rawSync2)
	if err != nil {
		t.Fatalf("failed to unpack room sync: %v", err)
	}
	if len(syncPayload2.Participants) != 2 {
		t.Errorf("expected 2 participants in room.sync, got %d", len(syncPayload2.Participants))
	}

	// Кандидат должен получить presence.join о входе собеседующего
	_, msgCandidateJoin, err := connCandidate.Read(ctx)
	if err != nil {
		t.Fatalf("candidate failed to read presence.join: %v", err)
	}
	rawJoin, err := ws.ParseRawEnvelope(msgCandidateJoin)
	if err != nil {
		t.Fatalf("candidate failed to parse presence.join: %v", err)
	}
	if rawJoin.Type != ws.EventPresenceJoin {
		t.Errorf("expected event %s, got %s", ws.EventPresenceJoin, rawJoin.Type)
	}

	// 6. Кандидат печатает код и отправляет code.update
	codeEnv := ws.NewEnvelope(ws.EventCodeUpdate, sessionID, "req-c1", ws.CodeUpdatePayload{
		FilePath: "main.go",
		Language: "go",
		Content:  "package main\n\nfunc main() {}\n",
		Version:  1,
	})
	codeBytes, err := codeEnv.ToBytes()
	if err != nil {
		t.Fatalf("failed to serialize code envelope: %v", err)
	}

	if err := connCandidate.Write(ctx, websocket.MessageText, codeBytes); err != nil {
		t.Fatalf("candidate failed to write code.update: %v", err)
	}

	// Собеседующий должен получить этот code.update
	_, msgInterviewerCode, err := connInterviewer.Read(ctx)
	if err != nil {
		t.Fatalf("interviewer failed to read code.update: %v", err)
	}
	rawCode, err := ws.ParseRawEnvelope(msgInterviewerCode)
	if err != nil {
		t.Fatalf("interviewer failed to parse code envelope: %v", err)
	}
	if rawCode.Type != ws.EventCodeUpdate {
		t.Errorf("expected %s, got %s", ws.EventCodeUpdate, rawCode.Type)
	}
	unpackedCode, err := ws.UnpackPayload[ws.CodeUpdatePayload](rawCode)
	if err != nil {
		t.Fatalf("interviewer failed to unpack code: %v", err)
	}
	if unpackedCode.Content != "package main\n\nfunc main() {}\n" {
		t.Errorf("code content mismatch: %s", unpackedCode.Content)
	}

	// 7. Собеседующий двигает курсор и отправляет cursor.move
	cursorEnv := ws.NewEnvelope(ws.EventCursorMove, sessionID, "req-cur-1", ws.CursorPayload{
		UserID:   "int-1",
		Username: "Interviewer-Sarah",
		Line:     3,
		Column:   15,
	})
	cursorBytes, err := cursorEnv.ToBytes()
	if err != nil {
		t.Fatalf("failed to serialize cursor envelope: %v", err)
	}

	if err := connInterviewer.Write(ctx, websocket.MessageText, cursorBytes); err != nil {
		t.Fatalf("interviewer failed to write cursor.move: %v", err)
	}

	// Кандидат получает cursor.move от собеседующего
	_, msgCandidateCursor, err := connCandidate.Read(ctx)
	if err != nil {
		t.Fatalf("candidate failed to read cursor.move: %v", err)
	}
	rawCursor, err := ws.ParseRawEnvelope(msgCandidateCursor)
	if err != nil {
		t.Fatalf("candidate failed to parse cursor: %v", err)
	}
	if rawCursor.Type != ws.EventCursorMove {
		t.Errorf("expected %s, got %s", ws.EventCursorMove, rawCursor.Type)
	}

	// 8. Закрываем соединения
	_ = connCandidate.Close(websocket.StatusNormalClosure, "done")
	_ = connInterviewer.Close(websocket.StatusNormalClosure, "done")
}

func TestWebSocketRoomCapacityLimit(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	secret := "test-secret-capacity"
	tokenVerifier := auth.NewTokenVerifier(secret)
	hub := ws.NewHub(ctx, nil, nil, logger)

	// Ограничиваем комнату максимум 1 участником
	wsHandler := NewWebSocketHandler(hub, tokenVerifier, nil, logger, []string{"*"}, "access_token", 100, 1, true)

	r := chi.NewRouter()
	r.Get("/ws/sessions/{sessionId}", wsHandler.HandleSessionWS)

	ts := httptest.NewServer(r)
	defer ts.Close()

	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http")
	sessionID := "limited-room"

	tok1, _ := generateTestJWT(secret, "u-1", "User1", sessionID)
	tok2, _ := generateTestJWT(secret, "u-2", "User2", sessionID)

	// 1-й клиент подключается успешно
	dialOpts1 := &websocket.DialOptions{
		HTTPHeader: http.Header{"Cookie": []string{"access_token=" + tok1}},
	}
	conn1, err := dialWebSocket(
		ctx,
		wsURL+"/ws/sessions/"+sessionID,
		dialOpts1,
	)
	if err != nil {
		t.Fatalf("first user failed to connect: %v", err)
	}
	defer conn1.Close(websocket.StatusNormalClosure, "done")

	// 2-й клиент должен получить отказ (403 Forbidden: room is full)
	dialOpts2 := &websocket.DialOptions{
		HTTPHeader: http.Header{"Cookie": []string{"access_token=" + tok2}},
	}
	_, err = dialWebSocket(
		ctx,
		wsURL+"/ws/sessions/"+sessionID,
		dialOpts2,
	)
	if err == nil {
		t.Fatal("expected second user to be rejected because room is full, but succeeded")
	}
}

// helperHandler собирает тестовый WebSocketHandler с указанным SessionStore.
func helperHandler(t *testing.T, secret string, store storage.SessionStore, maxRoom int) (string, *ws.Hub) {
	t.Helper()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	hub := ws.NewHub(context.Background(), nil, store, logger)
	wsHandler := NewWebSocketHandler(hub, auth.NewTokenVerifier(secret), store, logger, []string{"*"}, "access_token", 10000, maxRoom, true)

	r := chi.NewRouter()
	r.Get("/ws/sessions/{sessionId}", wsHandler.HandleSessionWS)

	ts := httptest.NewServer(r)
	t.Cleanup(ts.Close)
	return "ws" + strings.TrimPrefix(ts.URL, "http"), hub
}

func TestWebSocketClosedSessionRejected(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	secret := "test-secret-closed"
	sessionStore := &mockSessionStore{
		roles:  map[string]string{"u-1": "candidate"},
		active: map[string]bool{"closed-room": false},
	}
	wsURL, _ := helperHandler(t, secret, sessionStore, 20)
	sessionID := "closed-room"

	tok, err := generateTestJWT(secret, "u-1", "User1", sessionID)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	dialOpts := &websocket.DialOptions{
		HTTPHeader: http.Header{"Cookie": []string{"access_token=" + tok}},
	}
	_, err = dialWebSocket(ctx, wsURL+"/ws/sessions/"+sessionID, dialOpts)
	if err == nil {
		t.Fatal("expected dial to a closed session to fail with 403, but succeeded")
	}
}

func TestWebSocketNonMemberRejected(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	secret := "test-secret-nonmember"
	// Активная сессия, но кандидат-не-участник (нет роли) → 403.
	sessionStore := &mockSessionStore{
		roles:  map[string]string{"member-1": "candidate"},
		active: map[string]bool{"room": true},
	}
	wsURL, _ := helperHandler(t, secret, sessionStore, 20)
	sessionID := "room"

	tok, err := generateTestJWT(secret, "stranger", "Stranger", sessionID)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	dialOpts := &websocket.DialOptions{
		HTTPHeader: http.Header{"Cookie": []string{"access_token=" + tok}},
	}
	_, err = dialWebSocket(ctx, wsURL+"/ws/sessions/"+sessionID, dialOpts)
	if err == nil {
		t.Fatal("expected non-member dial to fail with 403, but succeeded")
	}
}

// TestWebSocketTicketSingleUse проверяет одноразовость realtime-тикета (Phase C):
// первый коннект по тикету успешен, повторное использование того же тикета → 401.
func TestWebSocketTicketSingleUse(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	secret := "test-secret-ticket"
	store := &mockSessionStore{
		roles:  map[string]string{"user-1": "candidate"},
		active: map[string]bool{"room": true},
	}
	wsURL, _ := helperHandler(t, secret, store, 20)
	sessionID := "room"

	ticket, err := generateTestTicket(secret, "user-1", "User1", sessionID)
	if err != nil {
		t.Fatalf("failed to generate ticket: %v", err)
	}

	// 1-е использование тикета — успешно. Клиент предлагает два подпротокола:
	// "realtime" (для согласования) и сам тикет; заголовок получается
	// "realtime,<ticket>", откуда хендлер извлекает тикет.
	conn1, err := dialWebSocket(ctx, wsURL+"/ws/sessions/"+sessionID, &websocket.DialOptions{
		Subprotocols: []string{"realtime", ticket},
	})
	if err != nil {
		t.Fatalf("expected first ticket use to succeed, got: %v", err)
	}
	conn1.Close(websocket.StatusNormalClosure, "done")

	// Повторное использование того же тикета — отклоняется (ConsumeTicket=false → 401).
	if _, err = dialWebSocket(ctx, wsURL+"/ws/sessions/"+sessionID, &websocket.DialOptions{
		Subprotocols: []string{"realtime", ticket},
	}); err == nil {
		t.Fatal("expected ticket reuse to fail with 401, but succeeded")
	}
}

// TestWebSocketTicketBoundToAnotherSession проверяет, что тикет, привязанный
// к другой комнате, не позволяет подключиться к текущей (→ 403).
func TestWebSocketTicketBoundToAnotherSession(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	secret := "test-secret-ticket-bound"
	store := &mockSessionStore{
		roles:  map[string]string{"user-1": "candidate"},
		active: map[string]bool{"target-room": true},
	}
	wsURL, _ := helperHandler(t, secret, store, 20)

	// Тикет выдан для другой сессии, а коннектимся в "target-room".
	ticket, err := generateTestTicket(secret, "user-1", "User1", "other-room")
	if err != nil {
		t.Fatalf("failed to generate ticket: %v", err)
	}

	_, err = dialWebSocket(ctx, wsURL+"/ws/sessions/target-room", &websocket.DialOptions{
		Subprotocols: []string{"realtime", ticket},
	})
	if err == nil {
		t.Fatal("expected ticket bound to another session to fail with 403, but succeeded")
	}
}

// TestWebSocketAccessFallbackDisabled проверяет ветку C2: при
// allowAccessFallback=false доступ по access-токену закрыт (→ 403).
func TestWebSocketAccessFallbackDisabled(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	secret := "test-secret-fallback-off"
	store := &mockSessionStore{
		roles:  map[string]string{"user-1": "candidate"},
		active: map[string]bool{"room": true},
	}
	hub := ws.NewHub(context.Background(), nil, store, logger)
	wsHandler := NewWebSocketHandler(hub, auth.NewTokenVerifier(secret), store, logger, []string{"*"}, "access_token", 10000, 20, false)

	r := chi.NewRouter()
	r.Get("/ws/sessions/{sessionId}", wsHandler.HandleSessionWS)
	ts := httptest.NewServer(r)
	defer ts.Close()
	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http")

	// Валидный access-токен, что при включённом fallback прошёл бы — здесь отклонён.
	tok, err := generateTestJWT(secret, "user-1", "User1", "room")
	if err != nil {
		t.Fatalf("failed to generate access token: %v", err)
	}

	_, err = dialWebSocket(ctx, wsURL+"/ws/sessions/room", &websocket.DialOptions{
		HTTPHeader: http.Header{"Cookie": []string{"access_token=" + tok}},
	})
	if err == nil {
		t.Fatal("expected access-fallback-disabled dial to fail with 403, but succeeded")
	}
}
