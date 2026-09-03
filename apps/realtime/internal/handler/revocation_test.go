package handler

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/mockinterviewai/realtime/internal/ws"
)

// dialUser открывает реальное WS-соединение к комнате sessionID по access-токену.
func dialUser(t *testing.T, ctx context.Context, wsURL, sessionID, secret, userID string) *websocket.Conn {
	t.Helper()
	tok, err := generateTestJWT(secret, userID, "User-"+userID, sessionID)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}
	conn, _, err := websocket.Dial(ctx, wsURL+"/ws/sessions/"+sessionID, &websocket.DialOptions{
		HTTPHeader: http.Header{"Cookie": []string{"access_token=" + tok}},
	})
	if err != nil {
		t.Fatalf("failed to dial %s as %s: %v", sessionID, userID, err)
	}
	return conn
}

// expectCloseCode проверяет, что соединение будет закрыто с ожидаемым кодом.
func expectCloseCode(t *testing.T, ctx context.Context, conn *websocket.Conn, want websocket.StatusCode) {
	t.Helper()

	// Пропускаем любое количество входящих сообщений, пока не появится close-frame.
	for {
		if err := ctx.Err(); err != nil {
			t.Fatalf("timed out waiting for close code %d: %v", want, err)
		}
		_, _, err := conn.Read(ctx)
		if err == nil {
			continue
		}
		code := websocket.CloseStatus(err)
		if code == want {
			return
		}
		t.Fatalf("expected close code %d, got %d (err=%v)", want, code, err)
	}
}

// connClosedInWindow возвращает true, если соединение закрылось в течение таймаута.
func connClosedInWindow(ctx context.Context, conn *websocket.Conn) bool {
	rctx, rcancel := context.WithTimeout(ctx, 150*time.Millisecond)
	defer rcancel()
	_, _, err := conn.Read(rctx)
	return err != nil
}

// waitParticipants ожидает, пока hub зарегистрирует want постоянных клиентов.
// websocket.Dial возвращается после Accept, а Register в серверном обработчике
// выполняется чуть позже — evict в этом раннем окне пропустил бы клиента.
func waitParticipants(t *testing.T, hub *ws.Hub, want int) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if hub.TotalClients() == want {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("expected %d registered participants, got %d", want, hub.TotalClients())
}

// TestRevocationCloseSessionRoomScoped проверяет (P2, P11): при close-сессии
// участник закрывается кодом 1008 (StatusPolicyViolation), но тот же участник
// в другой активной сессии НЕ выкидывается.
func TestRevocationCloseSessionRoomScoped(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	secret := "test-secret-revoke-room"
	store := &mockSessionStore{
		roles: map[string]string{
			"user-1": "candidate",
			"user-2": "candidate",
		},
		active: map[string]bool{
			"session-a": true,
			"session-b": true,
		},
	}
	wsURL, hub := helperHandler(t, secret, store, 20)

	// user-1 подключён к session-a и session-b; user-2 — только к session-a.
	connA1 := dialUser(t, ctx, wsURL, "session-a", secret, "user-1")
	defer connA1.Close(websocket.StatusNormalClosure, "done")
	connB1 := dialUser(t, ctx, wsURL, "session-b", secret, "user-1")
	defer connB1.Close(websocket.StatusNormalClosure, "done")
	connA2 := dialUser(t, ctx, wsURL, "session-a", secret, "user-2")
	defer connA2.Close(websocket.StatusNormalClosure, "done")

	waitParticipants(t, hub, 3)

	// Закрываем session-a (room-scoped evict для user-1 и user-2).
	hub.EvictFromRoom("session-a", "user-1", "session closed")

	// user-1 должен быть закрыт из session-a кодом 1008.
	expectCloseCode(t, ctx, connA1, websocket.StatusPolicyViolation)

	// user-1 в ДРУГОЙ активной сессии — НЕ должен быть выкинут.
	if connClosedInWindow(ctx, connB1) {
		t.Fatal("user should NOT be evicted from the other active session")
	}
}

// TestRevocationLogoutUserGlobal проверяет (P11): logout/deactivate (user-level
// ревокация без sessionId) закрывает ВСЕ соединения пользователя кодом 1008.
func TestRevocationLogoutUserGlobal(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	secret := "test-secret-revoke-logout"
	store := &mockSessionStore{
		roles:  map[string]string{"user-1": "candidate"},
		active: map[string]bool{"session-a": true, "session-b": true},
	}
	wsURL, hub := helperHandler(t, secret, store, 20)

	connA := dialUser(t, ctx, wsURL, "session-a", secret, "user-1")
	defer connA.Close(websocket.StatusNormalClosure, "done")
	connB := dialUser(t, ctx, wsURL, "session-b", secret, "user-1")
	defer connB.Close(websocket.StatusNormalClosure, "done")

	waitParticipants(t, hub, 2)

	// logout → user-level evict по всем комнатам.
	hub.EvictUser("user-1", "user authentication revoked")

	expectCloseCode(t, ctx, connA, websocket.StatusPolicyViolation)
	expectCloseCode(t, ctx, connB, websocket.StatusPolicyViolation)
}

// TestRevocationDoesNotAffectOtherUser проверяет изоляцию: evict одного
// пользователя не закрывает другого в той же комнате.
func TestRevocationDoesNotAffectOtherUser(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	secret := "test-secret-revoke-isolate"
	store := &mockSessionStore{
		roles: map[string]string{
			"victim":    "candidate",
			"bystander": "candidate",
		},
		active: map[string]bool{"session-a": true},
	}
	wsURL, hub := helperHandler(t, secret, store, 20)

	connVictim := dialUser(t, ctx, wsURL, "session-a", secret, "victim")
	connBystander := dialUser(t, ctx, wsURL, "session-a", secret, "bystander")
	defer connBystander.Close(websocket.StatusNormalClosure, "done")

	waitParticipants(t, hub, 2)

	hub.EvictFromRoom("session-a", "victim", "session closed")

	expectCloseCode(t, ctx, connVictim, websocket.StatusPolicyViolation)
	if connClosedInWindow(ctx, connBystander) {
		t.Fatal("bystander in the same room should NOT be evicted")
	}
}

// TestRevocationEvictFromRoomUnknownSession проверяет, что evict несуществующей
// комнаты — безопасный no-op (без паники).
func TestRevocationEvictFromRoomUnknownSession(t *testing.T) {
	_, hub := helperHandler(t, "secret", nil, 20)
	hub.EvictFromRoom("does-not-exist", "user-1", "session closed")
	hub.EvictUser("user-1", "user authentication revoked")
}
