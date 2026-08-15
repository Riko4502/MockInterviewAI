package ws

import (
	"context"
	"log/slog"
	"sync"

	"github.com/mockinterviewai/realtime/internal/storage"
)

// Hub управляет всеми активными комнатами WebSocket сервиса.
type Hub struct {
	rooms        map[string]*Room
	broadcaster  storage.Broadcaster
	sessionStore storage.SessionStore
	mu           sync.RWMutex
	logger       *slog.Logger
	ctx          context.Context
	cancel       context.CancelFunc
	wg           sync.WaitGroup
}

// NewHub создает центральный реестр комнат с поддержкой межсерверного Broadcaster и SessionStore.
func NewHub(parentCtx context.Context, broadcaster storage.Broadcaster, sessionStore storage.SessionStore, logger *slog.Logger) *Hub {
	ctx, cancel := context.WithCancel(parentCtx)
	hub := &Hub{
		rooms:        make(map[string]*Room),
		broadcaster:  broadcaster,
		sessionStore: sessionStore,
		logger:       logger.With(slog.String("component", "hub")),
		ctx:          ctx,
		cancel:       cancel,
	}

	// Подписка на глобальные сигналы отзыва авторизации пользователей через Redis Pub/Sub
	if broadcaster != nil {
		unsubscribe, err := broadcaster.SubscribeRevocations(ctx, func(userID string) {
			hub.EvictUser(userID, "user authentication revoked")
		})
		if err == nil && unsubscribe != nil {
			go func() {
				<-ctx.Done()
				unsubscribe()
			}()
		}
	}

	return hub
}

// EvictUser принудительно отключает указанного пользователя во всех активных комнатах на данном сервере.
func (h *Hub) EvictUser(userID string, reason string) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, room := range h.rooms {
		room.EvictUser(userID, reason)
	}
}

// GetOrCreateRoom находит существующую комнату или создает новую и запускает ее воркер.
func (h *Hub) GetOrCreateRoom(sessionID string) *Room {
	h.mu.Lock()
	defer h.mu.Unlock()

	if room, exists := h.rooms[sessionID]; exists {
		return room
	}

	room := NewRoom(sessionID, h.broadcaster, h.sessionStore, h.logger, func(id string) {
		h.RemoveRoom(id)
	})

	h.rooms[sessionID] = room

	h.wg.Add(1)
	go func() {
		defer h.wg.Done()
		room.Run(h.ctx)
	}()

	h.logger.Info("created new room",
		slog.String("sessionId", sessionID),
		slog.Int("totalRooms", len(h.rooms)),
	)

	return room
}

// GetRoom возвращает комнату по sessionId, если она существует.
func (h *Hub) GetRoom(sessionID string) (*Room, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	room, exists := h.rooms[sessionID]
	return room, exists
}

// RemoveRoom удаляет пустую комнату из реестра.
func (h *Hub) RemoveRoom(sessionID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if room, exists := h.rooms[sessionID]; exists {
		room.Close()
		delete(h.rooms, sessionID)
		h.logger.Info("removed room",
			slog.String("sessionId", sessionID),
			slog.Int("remainingRooms", len(h.rooms)),
		)
	}
}

// TotalRooms возвращает количество активных комнат на данном сервере.
func (h *Hub) TotalRooms() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.rooms)
}

// TotalClients возвращает суммарное количество всех подключенных клиентов во всех комнатах на данном сервере.
func (h *Hub) TotalClients() int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	total := 0
	for _, room := range h.rooms {
		total += room.ParticipantCount()
	}
	return total
}

// Close останавливает все комнаты и ожидает завершения их горутин.
func (h *Hub) Close() error {
	h.logger.Info("initiating hub shutdown")
	h.cancel()

	h.mu.Lock()
	for id, room := range h.rooms {
		room.Close()
		delete(h.rooms, id)
	}
	h.mu.Unlock()

	h.wg.Wait()
	h.logger.Info("hub shutdown completed")
	return nil
}
