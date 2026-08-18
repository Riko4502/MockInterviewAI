package ws

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/mockinterviewai/realtime/internal/storage"
)

const (
	// roomIdleReapTimeout - время простоя пустой комнаты до автоматической выгрузки из памяти.
	roomIdleReapTimeout = 60 * time.Second
)

type broadcastMessage struct {
	data     []byte
	senderID string
	isRemote bool
}

// Room управляет списком участников конкретной сессии и рассылает сообщения между ними.
type Room struct {
	ID string

	clients       map[string]*Client
	register      chan *Client
	unregister    chan *Client
	broadcast     chan broadcastMessage
	done          chan struct{}
	closeOnce     sync.Once
	mu            sync.RWMutex
	logger        *slog.Logger
	onEmpty       func(roomID string)
	broadcaster   storage.Broadcaster
	sessionStore  storage.SessionStore
	lastCodeState *CodeUpdatePayload
}

// NewRoom создает новый экземпляр комнаты для сессии с поддержкой распределенного Broadcaster и SessionStore.
func NewRoom(
	id string,
	broadcaster storage.Broadcaster,
	sessionStore storage.SessionStore,
	logger *slog.Logger,
	onEmpty func(roomID string),
) *Room {
	return &Room{
		ID:           id,
		clients:      make(map[string]*Client),
		register:     make(chan *Client),
		unregister:   make(chan *Client),
		broadcast:    make(chan broadcastMessage, 256),
		done:         make(chan struct{}),
		logger:       logger.With(slog.String("roomId", id)),
		onEmpty:      onEmpty,
		broadcaster:  broadcaster,
		sessionStore: sessionStore,
	}
}

// Run запускает главный цикл обработки событий комнаты, подписывается на Redis Pub/Sub и выгружает пустые комнаты.
func (r *Room) Run(ctx context.Context) {
	r.logger.Info("room loop started")
	defer func() {
		r.logger.Info("room loop terminated")
	}()

	// Восстановление последнего снимка кода из Redis при запуске комнаты
	if r.sessionStore != nil {
		if codeBytes, err := r.sessionStore.GetCodeState(ctx, r.ID); err == nil && len(codeBytes) > 0 {
			var codePayload CodeUpdatePayload
			if unpackErr := json.Unmarshal(codeBytes, &codePayload); unpackErr == nil {
				r.mu.Lock()
				r.lastCodeState = &codePayload
				r.mu.Unlock()
				r.logger.Info("restored last code state from redis",
					slog.String("filePath", codePayload.FilePath),
					slog.Int64("version", codePayload.Version),
				)
			}
		}
	}

	// Подписка на распределенные события комнаты из Redis
	if r.broadcaster != nil {
		unsubscribe, err := r.broadcaster.Subscribe(ctx, r.ID, func(data []byte) {
			r.BroadcastFromRemote(data)
		})
		if err == nil && unsubscribe != nil {
			defer unsubscribe()
		}
	}

	idleTimer := time.NewTimer(roomIdleReapTimeout)
	defer idleTimer.Stop()

	for {
		select {
		case <-ctx.Done():
			r.Close()
			return
		case <-r.done:
			return
		case <-idleTimer.C:
			r.mu.RLock()
			count := len(r.clients)
			r.mu.RUnlock()

			if count == 0 {
				r.logger.Info("room idle timeout reached with 0 participants, reaping room")
				if r.onEmpty != nil {
					r.onEmpty(r.ID)
				}
				r.Close()
				return
			}
		case client := <-r.register:
			r.handleRegister(client)
			// Сбрасываем таймер простоя, так как в комнату зашел участник
			if !idleTimer.Stop() {
				select {
				case <-idleTimer.C:
				default:
				}
			}
		case client := <-r.unregister:
			r.handleUnregister(client)
			r.mu.RLock()
			count := len(r.clients)
			r.mu.RUnlock()

			if count == 0 {
				// Если участников не осталось, перезапускаем таймер простоя
				idleTimer.Reset(roomIdleReapTimeout)
			}
		case msg := <-r.broadcast:
			r.handleBroadcast(ctx, msg)
		}
	}
}

// handleRegister регистрирует клиента, вытесняет предыдущие соединения того же пользователя (1 User = 1 Connection) и шлет room.sync.
func (r *Room) handleRegister(client *Client) {
	r.mu.Lock()

	// 1. Политика одного активного соединения на пользователя в сессии:
	// Если пользователь уже был подключен (например, обновил вкладку), вытесняем старое соединение
	var oldClient *Client
	for _, existing := range r.clients {
		if existing.UserID == client.UserID {
			oldClient = existing
			break
		}
	}

	if oldClient != nil {
		r.logger.Info("displacing previous connection for same user in session",
			slog.String("userId", client.UserID),
			slog.String("oldClientId", oldClient.ID),
			slog.String("newClientId", client.ID),
		)
		delete(r.clients, oldClient.ID)
		go oldClient.Close(websocket.StatusGoingAway, "displaced by new connection")
	}

	r.clients[client.ID] = client
	count := len(r.clients)

	// Собираем список всех присутствующих участников
	participants := make([]ParticipantInfo, 0, count)
	for _, c := range r.clients {
		participants = append(participants, ParticipantInfo{
			UserID:   c.UserID,
			Username: c.Username,
			Role:     c.Role,
		})
	}
	codeSnapshot := r.lastCodeState
	r.mu.Unlock()

	r.logger.Info("client joined room",
		slog.String("clientId", client.ID),
		slog.String("userId", client.UserID),
		slog.Int("totalParticipants", count),
	)

	// 2. Отправляем персонально новичку снимок состояния комнаты (room.sync)
	syncEnv := NewEnvelope(
		EventRoomSync,
		r.ID,
		"",
		RoomSyncPayload{
			SessionID:    r.ID,
			Participants: participants,
			CodeState:    codeSnapshot,
		},
	)
	if syncBytes, err := syncEnv.ToBytes(); err == nil {
		client.Send(syncBytes)
	}

	// 3. Отправляем уведомление presence.join остальным участникам комнаты
	joinEnv := NewEnvelope(
		EventPresenceJoin,
		r.ID,
		"",
		PresencePayload{
			UserID:    client.UserID,
			Username:  client.Username,
			Role:      client.Role,
			UserCount: count,
		},
	)

	if joinBytes, err := joinEnv.ToBytes(); err == nil {
		r.Broadcast(joinBytes, client.ID)
	}
}

// handleUnregister удаляет клиента и уведомляет оставшихся участников.
func (r *Room) handleUnregister(client *Client) {
	r.mu.Lock()
	if _, exists := r.clients[client.ID]; !exists {
		r.mu.Unlock()
		return
	}
	delete(r.clients, client.ID)
	count := len(r.clients)
	r.mu.Unlock()

	r.logger.Info("client left room",
		slog.String("clientId", client.ID),
		slog.String("userId", client.UserID),
		slog.Int("remainingParticipants", count),
	)

	// Уведомляем оставшихся о выходе
	leaveEnv := NewEnvelope(
		EventPresenceLeave,
		r.ID,
		"",
		PresencePayload{
			UserID:    client.UserID,
			Username:  client.Username,
			Role:      client.Role,
			UserCount: count,
		},
	)

	if leaveBytes, err := leaveEnv.ToBytes(); err == nil {
		r.Broadcast(leaveBytes, client.ID)
	}
}

// handleBroadcast рассылает сообщение локальным клиентам и публикует в Redis для других реплик.
func (r *Room) handleBroadcast(ctx context.Context, msg broadcastMessage) {
	// Если это обновление кода, обновляем сохраненный снимок для будущих участников и сохраняем в Redis
	if raw, err := ParseRawEnvelope(msg.data); err == nil && raw.Type == EventCodeUpdate {
		if codePayload, unpackErr := UnpackPayload[CodeUpdatePayload](raw); unpackErr == nil {
			r.mu.Lock()
			r.lastCodeState = &codePayload
			r.mu.Unlock()

			// Сохраняем актуальный снимок кода в Redis
			if r.sessionStore != nil {
				if payloadBytes, marshalErr := json.Marshal(codePayload); marshalErr == nil {
					_ = r.sessionStore.SaveCodeState(ctx, r.ID, payloadBytes)
				}
			}
		}
	}

	// 1. Рассылка подключенным клиентам на текущем сервере
	r.mu.RLock()
	for clientID, client := range r.clients {
		if msg.senderID != "" && clientID == msg.senderID {
			continue
		}
		client.Send(msg.data)
	}
	r.mu.RUnlock()

	// 2. Если сообщение локальное — публикуем в Redis для участников на других репликах
	if !msg.isRemote && r.broadcaster != nil {
		_ = r.broadcaster.Publish(ctx, r.ID, msg.data)
	}
}

// Register регистрирует клиента в комнате.
func (r *Room) Register(client *Client) {
	select {
	case <-r.done:
		return
	case r.register <- client:
	}
}

// Unregister удаляет клиента из комнаты.
func (r *Room) Unregister(client *Client) {
	select {
	case <-r.done:
		return
	case r.unregister <- client:
	}
}

// Broadcast отправляет сообщение всем участникам комнаты (локально и в Redis).
func (r *Room) Broadcast(data []byte, senderID string) {
	select {
	case <-r.done:
		return
	case r.broadcast <- broadcastMessage{data: data, senderID: senderID, isRemote: false}:
	}
}

// BroadcastFromRemote отправляет сообщение, полученное из Redis, локальным клиентам без повторной публикации в Redis.
func (r *Room) BroadcastFromRemote(data []byte) {
	select {
	case <-r.done:
		return
	case r.broadcast <- broadcastMessage{data: data, senderID: "", isRemote: true}:
	}
}

// EvictUser принудительно отключает конкретного пользователя из комнаты (при отзыве токена).
func (r *Room) EvictUser(userID string, reason string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	for clientID, client := range r.clients {
		if client.UserID == userID {
			delete(r.clients, clientID)
			r.logger.Warn("evicting user from room due to token revocation",
				slog.String("userId", userID),
				slog.String("clientId", clientID),
				slog.String("reason", reason),
			)
			go client.Close(websocket.StatusPolicyViolation, reason)
		}
	}
}

// ParticipantCount возвращает текущее число подключенных клиентов на этой реплике.
func (r *Room) ParticipantCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.clients)
}

// Close корректно закрывает комнату и всех ее клиентов.
func (r *Room) Close() {
	r.closeOnce.Do(func() {
		close(r.done)

		r.mu.Lock()
		defer r.mu.Unlock()

		for _, client := range r.clients {
			client.Close(websocket.StatusNormalClosure, "room closed")
		}
		r.clients = make(map[string]*Client)
		r.lastCodeState = nil
		r.logger.Info("room closed successfully")
	})
}
