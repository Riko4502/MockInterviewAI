package sse

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"

	"github.com/mockinterviewai/realtime/internal/storage"
)

// fakeNotificationStore — минимальная реализация storage.NotificationStore
// поверх канала, позволяющая проверять фазы Replay и Live Streaming без Redis.
type fakeNotificationStore struct {
	live chan storage.StreamEvent

	mu      sync.Mutex
	history []storage.StreamEvent
	counts  map[string]int64
}

func newFakeStore() *fakeNotificationStore {
	return &fakeNotificationStore{
		live:   make(chan storage.StreamEvent, 64),
		counts: make(map[string]int64),
	}
}

func (f *fakeNotificationStore) PublishNotification(_ context.Context, _, eventType string, payload []byte) (string, error) {
	event := storage.StreamEvent{
		ID:      "1724500000000-0",
		Type:    eventType,
		Payload: payload,
	}

	f.mu.Lock()
	f.history = append(f.history, event)
	f.mu.Unlock()

	f.live <- event

	return event.ID, nil
}

func (f *fakeNotificationStore) ReadHistory(_ context.Context, _, afterID string, _ int64) ([]storage.StreamEvent, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	missed := make([]storage.StreamEvent, 0, len(f.history))
	for _, event := range f.history {
		if CompareStreamIDs(event.ID, afterID) > 0 {
			missed = append(missed, event)
		}
	}

	return missed, nil
}

func (f *fakeNotificationStore) ReadStream(
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

func (f *fakeNotificationStore) LastStreamID(context.Context, string) (string, error) {
	return "0-0", nil
}

func (f *fakeNotificationStore) PublishBroadcast(context.Context, string, []byte) error {
	return nil
}

func (f *fakeNotificationStore) SubscribeBroadcast(context.Context, func(storage.BroadcastMessage)) (func(), error) {
	return func() {}, nil
}

func (f *fakeNotificationStore) IncrUserConnections(_ context.Context, userID string) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.counts[userID]++

	return f.counts[userID], nil
}

func (f *fakeNotificationStore) DecrUserConnections(_ context.Context, userID string) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.counts[userID]--

	return nil
}

func (f *fakeNotificationStore) Enabled() bool {
	return true
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func newTestHub(t *testing.T, store storage.NotificationStore, opts Options) *Hub {
	t.Helper()

	hub := NewHub(context.Background(), store, nil, opts, "test-node", testLogger())
	t.Cleanup(func() {
		_ = hub.Close()
	})

	return hub
}

func newTestClient(hub *Hub, id, userID, ip string) *Client {
	opts := hub.Options()
	return NewClient(id, userID, ip, opts.ClientBufferSize, opts.SlowConsumerGrace, hub.Metrics(), testLogger())
}

func TestHubEnforcesPerUserConnectionLimit(t *testing.T) {
	hub := newTestHub(t, newFakeStore(), Options{MaxConnectionsPerUser: 2, MaxConnectionsPerIP: 100})

	first := newTestClient(hub, "c1", "user-1", "10.0.0.1")
	second := newTestClient(hub, "c2", "user-1", "10.0.0.2")
	third := newTestClient(hub, "c3", "user-1", "10.0.0.3")

	if err := hub.Register(context.Background(), first); err != nil {
		t.Fatalf("first tab must be accepted: %v", err)
	}

	if err := hub.Register(context.Background(), second); err != nil {
		t.Fatalf("second tab must be accepted: %v", err)
	}

	if err := hub.Register(context.Background(), third); !errors.Is(err, ErrUserConnectionLimit) {
		t.Fatalf("expected ErrUserConnectionLimit, got %v", err)
	}

	clients, users := hub.Stats()
	if clients != 2 || users != 1 {
		t.Errorf("expected 2 clients of 1 user, got %d clients / %d users", clients, users)
	}

	// После закрытия вкладки слот должен освободиться.
	hub.Unregister(second)

	if err := hub.Register(context.Background(), third); err != nil {
		t.Fatalf("slot must be released after unregister: %v", err)
	}
}

func TestHubEnforcesPerIPConnectionLimit(t *testing.T) {
	hub := newTestHub(t, newFakeStore(), Options{MaxConnectionsPerUser: 10, MaxConnectionsPerIP: 2})

	for i, userID := range []string{"user-1", "user-2"} {
		client := newTestClient(hub, "c"+userID, userID, "203.0.113.7")
		if err := hub.Register(context.Background(), client); err != nil {
			t.Fatalf("connection %d must be accepted: %v", i, err)
		}
	}

	blocked := newTestClient(hub, "c-blocked", "user-3", "203.0.113.7")
	if err := hub.Register(context.Background(), blocked); !errors.Is(err, ErrIPConnectionLimit) {
		t.Fatalf("expected ErrIPConnectionLimit, got %v", err)
	}
}

func TestHubMultiplexesEventToAllTabsOfUser(t *testing.T) {
	store := newFakeStore()
	hub := newTestHub(t, store, Options{StreamBlockInterval: 50 * time.Millisecond})

	tabA := newTestClient(hub, "tab-a", "user-1", "10.0.0.1")
	tabB := newTestClient(hub, "tab-b", "user-1", "10.0.0.1")

	if err := hub.Register(context.Background(), tabA); err != nil {
		t.Fatalf("failed to register first tab: %v", err)
	}

	if err := hub.Register(context.Background(), tabB); err != nil {
		t.Fatalf("failed to register second tab: %v", err)
	}

	if _, err := store.PublishNotification(context.Background(), "user-1", "notification.new", []byte(`{"id":"n1"}`)); err != nil {
		t.Fatalf("failed to publish notification: %v", err)
	}

	for name, client := range map[string]*Client{"tab-a": tabA, "tab-b": tabB} {
		select {
		case env := <-client.Events():
			if env.Type != EventNotificationNew {
				t.Errorf("%s received unexpected event type %q", name, env.Type)
			}
			if env.ID != "1724500000000-0" {
				t.Errorf("%s received unexpected event id %q", name, env.ID)
			}
		case <-time.After(2 * time.Second):
			t.Fatalf("%s did not receive the multiplexed event", name)
		}
	}
}

func TestHubStopsReaderWhenLastTabDisconnects(t *testing.T) {
	hub := newTestHub(t, newFakeStore(), Options{StreamBlockInterval: 20 * time.Millisecond})

	client := newTestClient(hub, "tab-a", "user-1", "10.0.0.1")
	if err := hub.Register(context.Background(), client); err != nil {
		t.Fatalf("failed to register client: %v", err)
	}

	hub.Unregister(client)

	if clients, users := hub.Stats(); clients != 0 || users != 0 {
		t.Errorf("expected an empty hub, got %d clients / %d users", clients, users)
	}
}

func TestHubEvictUserSendsAuthRevokedAndCloses(t *testing.T) {
	hub := newTestHub(t, newFakeStore(), Options{StreamBlockInterval: 50 * time.Millisecond})

	client := newTestClient(hub, "tab-a", "user-1", "10.0.0.1")
	if err := hub.Register(context.Background(), client); err != nil {
		t.Fatalf("failed to register client: %v", err)
	}

	hub.EvictUser("user-1", "password changed")

	select {
	case env := <-client.Events():
		if env.Type != EventAuthRevoked {
			t.Errorf("expected auth.revoked, got %q", env.Type)
		}
		if env.ID != "" {
			t.Errorf("auth.revoked must not carry a stream id, got %q", env.ID)
		}
	default:
		t.Fatal("client did not receive the final auth.revoked event")
	}

	select {
	case <-client.Done():
	default:
		t.Fatal("client connection must be closed after revocation")
	}
}

func TestSlowConsumerDropsAndClosesAfterGrace(t *testing.T) {
	metrics := NewMetrics("test-node")
	client := NewClient("tab-a", "user-1", "10.0.0.1", 1, 20*time.Millisecond, metrics, testLogger())

	env, err := NewEnvelope("1-0", EventNotificationBadge, NotificationBadgePayload{UnreadCount: 1})
	if err != nil {
		t.Fatalf("failed to build envelope: %v", err)
	}

	if !client.Send(env) {
		t.Fatal("first event must fit into the buffer")
	}

	// Буфер заполнен: событие отбрасывается, а таймер переполнения запускается.
	if client.Send(env) {
		t.Fatal("second event must be dropped, the buffer is full")
	}

	if client.Dropped() != 1 {
		t.Errorf("expected 1 dropped message, got %d", client.Dropped())
	}

	select {
	case <-client.Done():
		t.Fatal("connection must survive a short overflow")
	default:
	}

	time.Sleep(30 * time.Millisecond)

	if client.Send(env) {
		t.Fatal("third event must be dropped as well")
	}

	select {
	case <-client.Done():
	default:
		t.Fatal("connection must be closed after the overflow grace period")
	}

	if client.CloseReason() == "" {
		t.Error("close reason must be recorded")
	}
}

func TestSlowConsumerCounterResetsAfterDrain(t *testing.T) {
	metrics := NewMetrics("test-node")
	client := NewClient("tab-a", "user-1", "10.0.0.1", 1, 20*time.Millisecond, metrics, testLogger())

	env, err := NewEnvelope("1-0", EventNotificationBadge, NotificationBadgePayload{UnreadCount: 1})
	if err != nil {
		t.Fatalf("failed to build envelope: %v", err)
	}

	client.Send(env)
	client.Send(env) // отброшено, буфер полон

	// Клиент разобрал буфер: отметка переполнения должна сброситься, и
	// соединение не должно закрываться по истечении grace-периода.
	<-client.Events()
	time.Sleep(30 * time.Millisecond)

	if !client.Send(env) {
		t.Fatal("event must fit after the buffer has been drained")
	}

	select {
	case <-client.Done():
		t.Fatal("a recovered client must not be disconnected")
	default:
	}
}

// TestHubKeepsGaugeConsistentOnClusterLimitReject закрывает регрессию учета
// метрик: при отказе по кластерному счетчику (лимит выбран вкладками на других
// нодах, локально свободно) откат регистрации делал DecConnectedClients без
// парного инкремента и уводил gauge realtime_sse_connected_clients в минус.
func TestHubKeepsGaugeConsistentOnClusterLimitReject(t *testing.T) {
	store := newFakeStore()

	// Лимит уже выбран вкладками пользователя на других нодах кластера.
	store.mu.Lock()
	store.counts["user-cluster"] = 10
	store.mu.Unlock()

	hub := newTestHub(t, store, Options{MaxConnectionsPerUser: 5})

	if got := hub.Metrics().ConnectedClients(); got != 0 {
		t.Fatalf("expected a clean gauge before the test, got %d", got)
	}

	client := newTestClient(hub, "c1", "user-cluster", "10.0.0.1")

	if err := hub.Register(context.Background(), client); !errors.Is(err, ErrUserConnectionLimit) {
		t.Fatalf("expected ErrUserConnectionLimit, got %v", err)
	}

	if got := hub.Metrics().ConnectedClients(); got != 0 {
		t.Errorf("connected clients gauge must return to zero after a rejected registration, got %d", got)
	}

	if got := hub.Metrics().ActiveUsers(); got != 0 {
		t.Errorf("active users gauge must return to zero after a rejected registration, got %d", got)
	}

	// Слот в кластерном счетчике обязан быть освобожден.
	store.mu.Lock()
	remaining := store.counts["user-cluster"]
	store.mu.Unlock()

	if remaining != 10 {
		t.Errorf("cluster counter must be released back to 10, got %d", remaining)
	}

	// После освобождения места регистрация проходит и gauge растет ровно на единицу.
	store.mu.Lock()
	store.counts["user-cluster"] = 0
	store.mu.Unlock()

	accepted := newTestClient(hub, "c2", "user-cluster", "10.0.0.1")
	if err := hub.Register(context.Background(), accepted); err != nil {
		t.Fatalf("expected the next registration to succeed, got %v", err)
	}

	if got := hub.Metrics().ConnectedClients(); got != 1 {
		t.Errorf("expected gauge to be 1 after a successful registration, got %d", got)
	}

	hub.Unregister(accepted)

	if got := hub.Metrics().ConnectedClients(); got != 0 {
		t.Errorf("expected gauge to be 0 after unregister, got %d", got)
	}
}
