package ws

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"
)

func TestHubLifecycle(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	hub := NewHub(ctx, nil, nil, logger)

	if hub.TotalRooms() != 0 {
		t.Errorf("expected 0 rooms, got %d", hub.TotalRooms())
	}

	// 1. Создание комнат
	r1 := hub.GetOrCreateRoom("session-1")
	if r1 == nil {
		t.Fatal("expected room to be created, got nil")
	}

	if hub.TotalRooms() != 1 {
		t.Errorf("expected 1 room, got %d", hub.TotalRooms())
	}

	// Повторный запрос должен вернуть ту же самую комнату
	r1Again := hub.GetOrCreateRoom("session-1")
	if r1 != r1Again {
		t.Error("expected same room instance for identical sessionId")
	}

	// Создание второй комнаты
	_ = hub.GetOrCreateRoom("session-2")
	if hub.TotalRooms() != 2 {
		t.Errorf("expected 2 rooms, got %d", hub.TotalRooms())
	}

	// 2. Получение существующей комнаты
	foundRoom, exists := hub.GetRoom("session-1")
	if !exists || foundRoom != r1 {
		t.Errorf("failed to get existing room by id")
	}

	_, exists = hub.GetRoom("non-existent")
	if exists {
		t.Error("expected exists=false for non-existent room")
	}

	// 3. Удаление комнаты
	hub.RemoveRoom("session-1")
	if hub.TotalRooms() != 1 {
		t.Errorf("expected 1 remaining room, got %d", hub.TotalRooms())
	}

	// 4. Graceful Close
	err := hub.Close()
	if err != nil {
		t.Errorf("failed to close hub: %v", err)
	}

	if hub.TotalRooms() != 0 {
		t.Errorf("expected 0 rooms after hub close, got %d", hub.TotalRooms())
	}
}

func TestRoomLifecycle(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	emptyCalled := false

	room := NewRoom("test-session", nil, nil, logger, func(id string) {
		emptyCalled = true
	})

	go room.Run(ctx)

	if room.ParticipantCount() != 0 {
		t.Errorf("expected 0 participants, got %d", room.ParticipantCount())
	}

	room.Close()
	if !emptyCalled && room.ParticipantCount() != 0 {
		t.Errorf("unexpected room state after close")
	}
}

func TestRoomSingleUserConnectionDisplacement(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	room := NewRoom("test-session", nil, nil, logger, nil)
	go room.Run(ctx)

	// Клиент 1 (User A)
	c1Done := make(chan struct{})
	c1 := &Client{
		ID:        "client-tab-1",
		UserID:    "user-alex",
		Username:  "Alex",
		SessionID: "test-session",
		sendCh:    make(chan []byte, 10),
		doneCh:    c1Done,
		logger:    logger,
	}

	room.Register(c1)
	time.Sleep(20 * time.Millisecond)

	if room.ParticipantCount() != 1 {
		t.Fatalf("expected 1 participant, got %d", room.ParticipantCount())
	}

	// Клиент 2 (Тот же User A с новой вкладки)
	c2Done := make(chan struct{})
	c2 := &Client{
		ID:        "client-tab-2",
		UserID:    "user-alex",
		Username:  "Alex",
		SessionID: "test-session",
		sendCh:    make(chan []byte, 10),
		doneCh:    c2Done,
		logger:    logger,
	}

	room.Register(c2)
	time.Sleep(20 * time.Millisecond)

	// В комнате по-прежнему должен быть только 1 активный участник (c2)
	if room.ParticipantCount() != 1 {
		t.Fatalf("expected 1 participant after displacement, got %d", room.ParticipantCount())
	}

	// Проверяем, что в списке клиентов остался именно client-tab-2
	room.mu.RLock()
	activeClient, exists := room.clients["client-tab-2"]
	room.mu.RUnlock()

	if !exists || activeClient.ID != "client-tab-2" {
		t.Errorf("expected client-tab-2 to be active in room")
	}
}
