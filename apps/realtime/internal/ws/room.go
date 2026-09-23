package ws

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/mockinterviewai/realtime/internal/storage"
)

const (
	// roomIdleReapTimeout - время простоя пустой комнаты до автоматической выгрузки из памяти.
	roomIdleReapTimeout = 60 * time.Second

	// DefaultTaskKey - ключ задачи по умолчанию при инициализации комнаты.
	DefaultTaskKey = "task-1:typescript"
)

type broadcastMessage struct {
	data     []byte
	senderID string
	isRemote bool
}

// Room управляет списком участников конкретной сессии и рассылает сообщения между ними.
type Room struct {
	ID string

	clients          map[string]*Client
	register         chan *Client
	unregister       chan *Client
	broadcast        chan broadcastMessage
	codeUpdateQueue  chan broadcastMessage
	pubQueue         chan []byte
	codeSaveQueue    chan CodeUpdatePayload
	codeSaveSignal   chan struct{}
	done             chan struct{}
	closeOnce        sync.Once
	mu               sync.RWMutex
	logger           *slog.Logger
	onEmpty          func(roomID string)
	broadcaster      storage.Broadcaster
	sessionStore     storage.SessionStore
	yjsStore         storage.YjsDocStore
	saveQueue        *YjsSaveQueue
	activeTaskKey    string
	metrics          *Metrics
	codeVersion      int64
	lastCodeState    *CodeUpdatePayload
	pendingCodeState *CodeUpdatePayload
}

// NewRoom создает новый экземпляр комнаты для сессии с поддержкой распределенного Broadcaster и SessionStore.
func NewRoom(
	id string,
	broadcaster storage.Broadcaster,
	sessionStore storage.SessionStore,
	logger *slog.Logger,
	onEmpty func(roomID string),
) *Room {
	var yjsStore storage.YjsDocStore
	if ys, ok := sessionStore.(storage.YjsDocStore); ok {
		yjsStore = ys
	}
	roomLogger := logger.With(slog.String("roomId", id))
	return &Room{
		ID:              id,
		clients:         make(map[string]*Client),
		register:        make(chan *Client),
		unregister:      make(chan *Client),
		broadcast:       make(chan broadcastMessage, 256),
		codeUpdateQueue: make(chan broadcastMessage, 256),
		pubQueue:        make(chan []byte, 512),
		codeSaveQueue:   make(chan CodeUpdatePayload, 128),
		codeSaveSignal:  make(chan struct{}, 1),
		done:            make(chan struct{}),
		logger:          roomLogger,
		onEmpty:         onEmpty,
		broadcaster:     broadcaster,
		sessionStore:    sessionStore,
		yjsStore:        yjsStore,
		saveQueue:       NewYjsSaveQueue(yjsStore, roomLogger),
		activeTaskKey:   DefaultTaskKey,
	}
}

// SetYjsStore привязывает хранилище документов Yjs к комнате.
func (r *Room) SetYjsStore(ys storage.YjsDocStore) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.yjsStore = ys
	if r.saveQueue != nil {
		r.saveQueue.SetStore(ys)
	} else {
		r.saveQueue = NewYjsSaveQueue(ys, r.logger)
	}
}

// SaveQueue возвращает очередь сохранения дельт Yjs комнаты.
func (r *Room) SaveQueue() *YjsSaveQueue {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.saveQueue
}

// SetSaveQueue устанавливает очередь сохранения (для тестирования).
func (r *Room) SetSaveQueue(q *YjsSaveQueue) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.saveQueue = q
}

// ActiveTaskKey возвращает текущий ключ активной задачи комнаты.
func (r *Room) ActiveTaskKey() string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.activeTaskKey
}

// SetActiveTaskKey устанавливает текущий ключ активной задачи комнаты.
func (r *Room) SetActiveTaskKey(taskKey string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.activeTaskKey = taskKey
}

// SetMetrics привязывает провайдер SRE-метрик к комнате.
func (r *Room) SetMetrics(m *Metrics) {
	r.metrics = m
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
				r.codeVersion = codePayload.Version
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
		// Последовательный воркер публикации сообщений в Redis Pub/Sub
		go r.publishWorker(ctx)
	}

	// Последовательный воркер выделения версий кода для локальных событий (исключает блокировку Room.Run на Redis I/O)
	go r.codeUpdateWorker(ctx)

	// Последовательный воркер сохранения снимков кода в Redis
	if r.sessionStore != nil {
		var initialSavedVersion int64
		r.mu.RLock()
		if r.lastCodeState != nil {
			initialSavedVersion = r.lastCodeState.Version
		}
		r.mu.RUnlock()
		go r.codeSaveWorker(ctx, initialSavedVersion)
	}

	// Запуск воркера асинхронного сохранения Yjs дельт в Redis Stream
	if r.saveQueue != nil {
		go r.saveQueue.Start(ctx)
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
			r.handleRegister(ctx, client)
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

// handleRegister регистрирует клиента, вытесняет предыдущие соединения того же пользователя (1 User = 1 Connection),
// шлет room.sync, выполняет сборку и отправку yjs.init в строгом порядке Subscription-First и шлет presence.join.
func (r *Room) handleRegister(ctx context.Context, client *Client) {
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

	// Шаг 1 (Subscription-First): регистрация сокета в r.clients строго до чтения истории
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
	taskKey := r.activeTaskKey
	if taskKey == "" {
		taskKey = DefaultTaskKey
	}
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

	// 3. Синхронное продление TTL активной задачи в Redis и сборка yjs.init
	if r.yjsStore != nil {
		touchCtx, touchCancel := context.WithTimeout(ctx, 2*time.Second)
		_ = r.yjsStore.TouchTaskStream(touchCtx, r.ID, taskKey, StreamTTL)
		touchCancel()
	}

	if err := r.sendYjsInit(ctx, client, taskKey); err != nil {
		r.logger.Warn("failed to send yjs.init on client register",
			slog.String("clientId", client.ID),
			slog.String("taskKey", taskKey),
			slog.String("error", err.Error()),
		)
	}

	// 4. Отправляем уведомление presence.join остальным участникам комнаты
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

// sendYjsInit собирает историю правок документа для указанного taskKey в доказанном строгом порядке:
// Subscription-First -> GetPending(taskKey) -> XRANGE -> конкатенация -> yjs.init.
func (r *Room) sendYjsInit(ctx context.Context, client *Client, taskKey string) error {
	if taskKey == "" {
		r.mu.RLock()
		taskKey = r.activeTaskKey
		r.mu.RUnlock()
		if taskKey == "" {
			taskKey = DefaultTaskKey
		}
	}

	// Шаг 2 (после Шага 1 Subscription-First, где сокет уже зарегистрирован в r.clients):
	// Снимок локального in-memory буфера ДО чтения Redis Stream.
	// Метод GetPending самостоятельно инкапсулирует mu.RLock() и возвращает изолированную shallow copy.
	var pendingUpdates []string
	r.mu.RLock()
	sq := r.saveQueue
	r.mu.RUnlock()
	if sq != nil {
		pendingUpdates = sq.GetPending(taskKey)
	}

	// Шаг 3: Чтение сохраненной истории из Redis Stream (XRANGE) ПОСЛЕ фиксации среза буфера
	var streamUpdates []string
	r.mu.RLock()
	ys := r.yjsStore
	r.mu.RUnlock()
	if ys != nil {
		fetchCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
		updates, err := ys.GetTaskUpdates(fetchCtx, r.ID, taskKey)
		cancel()
		if err != nil {
			r.logger.Warn("failed to fetch task updates from stream for yjs.init",
				slog.String("sessionId", r.ID),
				slog.String("taskKey", taskKey),
				slog.String("error", err.Error()),
			)
			// При ошибке чтения XRANGE отправляем клиенту room.error (SYNC_FAILED) и закрываем сокет с 1013 (StatusTryAgainLater)
			if errBytes, mErr := NewRoomErrorEnvelope(r.ID, "", ErrCodeSyncFailed, "failed to load document history from redis", taskKey); mErr == nil {
				client.Send(errBytes)
			}
			go client.Close(websocket.StatusTryAgainLater, "failed to load document history")
			return err
		}
		streamUpdates = updates

		// Если стрим и буфер пусты, проверяем / выполняем ленивый сидинг
		if len(streamUpdates) == 0 && len(pendingUpdates) == 0 {
			seedCtx, seedCancel := context.WithTimeout(ctx, 2*time.Second)
			_, _ = ys.SeedTaskDoc(seedCtx, r.ID, taskKey, "AAA=", 86400)
			seedCancel()
			fetchCtx2, fetchCancel2 := context.WithTimeout(ctx, 2*time.Second)
			if refreshed, refErr := ys.GetTaskUpdates(fetchCtx2, r.ID, taskKey); refErr == nil && len(refreshed) > 0 {
				streamUpdates = refreshed
			}
			fetchCancel2()
		}
	}

	// Шаг 4: Конкатенация дельт (streamUpdates + pendingUpdates)
	totalLen := len(streamUpdates) + len(pendingUpdates)
	allUpdates := make([]string, 0, totalLen)
	allUpdates = append(allUpdates, streamUpdates...)
	allUpdates = append(allUpdates, pendingUpdates...)

	// Шаг 5: Формирование конверта yjs.init и отправка клиенту
	initBytes, err := NewYjsInitEnvelope(r.ID, "", taskKey, allUpdates)
	if err != nil {
		return fmt.Errorf("failed to marshal yjs.init envelope: %w", err)
	}

	if !client.Send(initBytes) {
		r.logger.Warn("client send buffer full when sending yjs.init, evicting slow consumer",
			slog.String("clientId", client.ID),
			slog.String("taskKey", taskKey),
		)
		r.mu.Lock()
		delete(r.clients, client.ID)
		r.mu.Unlock()
		go client.Close(websocket.StatusPolicyViolation, "send buffer overflow (slow consumer)")
		return errors.New("client send buffer full")
	}

	return nil
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

// handleBroadcast рассылает сообщение локальным клиентам, ставит в очередь на сохранение и на публикацию в Redis.
func (r *Room) handleBroadcast(_ context.Context, msg broadcastMessage) {
	raw, err := ParseRawEnvelope(msg.data)
	if err != nil {
		return
	}

	// 1. Если это обновление кода (legacy), обновляем снимок в памяти и ставим в очередь упорядоченного сохранения.
	if raw.Type == EventCodeUpdate {
		if codePayload, unpackErr := UnpackPayload[CodeUpdatePayload](raw); unpackErr == nil {
			r.mu.Lock()
			if !msg.isRemote {
				r.lastCodeState = &codePayload
			} else {
				// Сообщение из Redis от другой реплики: принимаем версию, только если она строго новее
				if r.lastCodeState != nil && codePayload.Version <= r.lastCodeState.Version {
					r.logger.Debug("dropping out-of-order remote code update before broadcast and save",
						slog.Int64("version", codePayload.Version),
						slog.Int64("lastCodeVersion", r.lastCodeState.Version),
					)
					r.mu.Unlock()
					return
				}
				if codePayload.Version <= r.codeVersion && r.codeVersion > 0 {
					r.logger.Debug("dropping out-of-order remote code update before broadcast and save",
						slog.Int64("version", codePayload.Version),
						slog.Int64("codeVersion", r.codeVersion),
					)
					r.mu.Unlock()
					return
				}
				if codePayload.Version > r.codeVersion {
					r.codeVersion = codePayload.Version
				}
				r.lastCodeState = &codePayload
			}
			r.mu.Unlock()

			if r.sessionStore != nil {
				select {
				case r.codeSaveQueue <- codePayload:
				default:
					// Очередь заполнена (slow Redis / burst) — coalescing:
					// сохраняем новейший снимок в pending-слот, чтобы он не был потерян
					r.mu.Lock()
					if r.pendingCodeState == nil || codePayload.Version > r.pendingCodeState.Version {
						r.pendingCodeState = &codePayload
					}
					r.mu.Unlock()

					// Сигнализируем воркеру о наличии не примененного coalesced-снимка
					select {
					case r.codeSaveSignal <- struct{}{}:
					default:
					}

					r.logger.Warn("code save queue is full, coalesced into pending snapshot slot",
						slog.Int64("version", codePayload.Version),
					)
				}
			}
		}
	}

	// 2. Обработка Yjs дельт: помещение в yjsSaveQueue и немедленный Ingress ACK автору
	if raw.Type == EventYjsUpdate {
		if payload, unpackErr := UnpackPayload[YjsUpdatePayload](raw); unpackErr == nil {
			if !msg.isRemote {
				// 2a. Помещение дельты в оперативную очередь yjsSaveQueue
				r.mu.RLock()
				sq := r.saveQueue
				r.mu.RUnlock()
				if sq != nil {
					update := &PendingUpdate{
						SessionID:  r.ID,
						TaskKey:    payload.TaskKey,
						UpdateID:   payload.UpdateID,
						Data:       payload.Data,
						EnqueuedAt: time.Now(),
					}
					if qErr := sq.Enqueue(update); qErr != nil {
						r.logger.Warn("yjs save queue full, rejecting update",
							slog.String("taskKey", payload.TaskKey),
							slog.String("updateId", payload.UpdateID),
							slog.String("error", qErr.Error()),
						)
						// Отправляем room.error (SYNC_FAILED) автору
						r.mu.RLock()
						sender := r.clients[msg.senderID]
						r.mu.RUnlock()
						if sender != nil {
							if errBytes, mErr := NewRoomErrorEnvelope(r.ID, raw.RequestID, ErrCodeSyncFailed, "server queue is full", payload.TaskKey); mErr == nil {
								sender.Send(errBytes)
							}
						}
						return
					}
				}

				// 2b. Немедленная отправка Ingress ACK (yjs.ack) автору
				r.mu.RLock()
				sender := r.clients[msg.senderID]
				r.mu.RUnlock()
				if sender != nil {
					if ackBytes, mErr := NewYjsAckEnvelope(r.ID, raw.RequestID, payload.TaskKey, payload.UpdateID); mErr == nil {
						if !sender.Send(ackBytes) {
							r.mu.Lock()
							delete(r.clients, sender.ID)
							r.mu.Unlock()
							go sender.Close(websocket.StatusPolicyViolation, "send buffer overflow (slow consumer)")
						}
					}
				}

				// 2c. Обновляем activeTaskKey комнаты, если не был установлен
				r.mu.Lock()
				if r.activeTaskKey == "" || r.activeTaskKey == DefaultTaskKey {
					r.activeTaskKey = payload.TaskKey
				}
				r.mu.Unlock()
			}
		}
	}

	// 3. Обработка переключения задачи task.switch (T030)
	if raw.Type == EventTaskSwitch {
		if payload, unpackErr := UnpackPayload[TaskSwitchPayload](raw); unpackErr == nil && payload.TaskKey != "" {
			r.mu.Lock()
			r.activeTaskKey = payload.TaskKey
			r.mu.Unlock()

			go func(taskKey, requestID string) {
				// 1. Атомарный сидинг / проверка целевой задачи в Redis через seed_task_doc.lua
				r.mu.RLock()
				ys := r.yjsStore
				r.mu.RUnlock()
				if ys != nil {
					sCtx, sCancel := context.WithTimeout(context.Background(), 3*time.Second)
					_, _ = ys.SeedTaskDoc(sCtx, r.ID, taskKey, "AAA=", 86400)
					sCancel()
				}

				// 2. Широковещательная рассылка task.switched всем участникам
				switchedEnv := NewEnvelope(EventTaskSwitched, r.ID, requestID, TaskSwitchedPayload{
					TaskKey: taskKey,
				})
				if switchedBytes, mErr := switchedEnv.ToBytes(); mErr == nil {
					r.Broadcast(switchedBytes, "")
				}

				// 3. Отгрузка yjs.init для новой задачи всем участникам
				r.mu.RLock()
				clients := make([]*Client, 0, len(r.clients))
				for _, c := range r.clients {
					clients = append(clients, c)
				}
				r.mu.RUnlock()

				for _, c := range clients {
					_ = r.sendYjsInit(context.Background(), c, taskKey)
				}
			}(payload.TaskKey, raw.RequestID)
			return
		}
	}

	// 4. Немедленная рассылка подключенным клиентам на текущем сервере с защитой от slow consumer
	r.mu.RLock()
	var slowClients []*Client
	for clientID, client := range r.clients {
		if msg.senderID != "" && clientID == msg.senderID {
			continue
		}
		if !client.Send(msg.data) {
			slowClients = append(slowClients, client)
		}
	}
	r.mu.RUnlock()

	// Принудительное закрытие сокета медленного клиента при переполнении sendCh
	if len(slowClients) > 0 {
		r.mu.Lock()
		for _, sc := range slowClients {
			delete(r.clients, sc.ID)
			r.logger.Warn("closing slow consumer due to sendCh overflow",
				slog.String("clientId", sc.ID),
				slog.String("userId", sc.UserID),
			)
			go sc.Close(websocket.StatusPolicyViolation, "send buffer overflow (slow consumer)")
		}
		r.mu.Unlock()
	}

	// 5. Если сообщение локальное — ставим в последовательную очередь упорядоченной публикации в Redis Pub/Sub
	if !msg.isRemote && r.broadcaster != nil {
		select {
		case r.pubQueue <- msg.data:
		default:
			r.logger.Warn("redis publish queue is full, dropping outbound message")
		}
	}
}

// publishWorker последовательно публикует события комнаты в Redis Pub/Sub в строгом порядке поступления (FIFO).
func (r *Room) publishWorker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-r.done:
			return
		case data := <-r.pubQueue:
			pubCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			if err := r.broadcaster.Publish(pubCtx, r.ID, data); err != nil {
				r.logger.Warn("failed to publish message to redis",
					slog.String("error", err.Error()),
				)
			}
			cancel()
		}
	}
}

// codeSaveWorker последовательно и условно (по возрастанию Version) сохраняет снимки кода в Redis с повтором при ошибках.
func (r *Room) codeSaveWorker(ctx context.Context, initialSavedVersion int64) {
	lastSavedVersion := initialSavedVersion
	var retryTimer *time.Timer
	var retryC <-chan time.Time
	retryBackoff := 50 * time.Millisecond
	const maxBackoff = 1 * time.Second

	scheduleRetry := func() {
		if retryTimer != nil {
			retryTimer.Stop()
		}
		retryTimer = time.NewTimer(retryBackoff)
		retryC = retryTimer.C
		retryBackoff *= 2
		if retryBackoff > maxBackoff {
			retryBackoff = maxBackoff
		}
	}

	cancelRetry := func() {
		if retryTimer != nil {
			retryTimer.Stop()
			retryTimer = nil
		}
		retryC = nil
		retryBackoff = 50 * time.Millisecond
	}
	defer func() {
		if retryTimer != nil {
			retryTimer.Stop()
		}
	}()

	savePayload := func(payload CodeUpdatePayload) bool {
		// Условная запись: если версия меньше или равна уже сохраненной, пропускаем (защита от race conditions и дубликатов)
		if payload.Version <= lastSavedVersion {
			r.logger.Debug("skipping out-of-order code save",
				slog.Int64("version", payload.Version),
				slog.Int64("lastSavedVersion", lastSavedVersion),
			)
			return true
		}

		payloadBytes, err := json.Marshal(payload)
		if err != nil {
			r.logger.Warn("failed to marshal code payload for redis snapshot",
				slog.String("error", err.Error()),
				slog.Int64("version", payload.Version),
			)
			return true
		}

		saveCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if err := r.sessionStore.SaveCodeState(saveCtx, r.ID, payloadBytes); err != nil {
			r.logger.Warn("failed to save code state snapshot in redis, returning to pending slot for retry",
				slog.String("error", err.Error()),
				slog.Int64("version", payload.Version),
			)

			// Возвращаем failed payload в coalescing-слот (сохраняя более новую версию, если она уже появилась)
			r.mu.Lock()
			if r.pendingCodeState == nil || payload.Version > r.pendingCodeState.Version {
				failedPayload := payload
				r.pendingCodeState = &failedPayload
			}
			r.mu.Unlock()

			scheduleRetry()
			return false
		}

		lastSavedVersion = payload.Version
		cancelRetry()
		return true
	}

	drainPending := func() {
		for {
			r.mu.Lock()
			var pending *CodeUpdatePayload
			if r.pendingCodeState != nil && r.pendingCodeState.Version > lastSavedVersion {
				pending = r.pendingCodeState
				r.pendingCodeState = nil
			} else {
				r.pendingCodeState = nil
			}
			r.mu.Unlock()

			if pending == nil {
				return
			}
			if ok := savePayload(*pending); !ok {
				// При ошибке savePayload вернул снимок в pendingCodeState и запланировал retryTimer.
				// Прерываем drainPending во избежание busy loop!
				return
			}
		}
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-r.done:
			return
		case payload := <-r.codeSaveQueue:
			if ok := savePayload(payload); ok {
				drainPending()
			}
		case <-r.codeSaveSignal:
			drainPending()
		case <-retryC:
			retryC = nil
			drainPending()
		}
	}
}

// codeUpdateWorker последовательно выделяет глобальные номера версий из Redis в фоновом режиме,
// исключая блокировку главного цикла Room.Run на сетевом I/O к Redis.
func (r *Room) codeUpdateWorker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-r.done:
			return
		case msg := <-r.codeUpdateQueue:
			raw, err := ParseRawEnvelope(msg.data)
			if err != nil || raw.Type != EventCodeUpdate {
				continue
			}
			codePayload, unpackErr := UnpackPayload[CodeUpdatePayload](raw)
			if unpackErr != nil {
				continue
			}

			var globalVersion int64
			if r.sessionStore != nil {
				const maxAttempts = 3
				backoff := 25 * time.Millisecond
				var lastErr error

				for attempt := 1; attempt <= maxAttempts; attempt++ {
					seqCtx, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
					v, allocErr := r.sessionStore.NextCodeVersion(seqCtx, r.ID)
					cancel()
					if allocErr == nil {
						globalVersion = v
						lastErr = nil
						break
					}
					lastErr = allocErr

					if attempt < maxAttempts {
						select {
						case <-ctx.Done():
							return
						case <-r.done:
							return
						case <-time.After(backoff):
							backoff *= 2
						}
					}
				}

				if lastErr != nil {
					r.logger.Error("failed to allocate global code version from redis after retries, falling back to local counter",
						slog.String("error", lastErr.Error()),
						slog.Int("attempts", maxAttempts),
					)
					if r.metrics != nil {
						r.metrics.IncCodeVersionFallback()
					}
				}
			}

			r.mu.Lock()
			if globalVersion <= r.codeVersion {
				r.codeVersion++
				globalVersion = r.codeVersion
			} else {
				r.codeVersion = globalVersion
			}
			codePayload.Version = globalVersion
			r.mu.Unlock()

			updatedEnv := NewEnvelope(raw.Type, raw.SessionID, raw.RequestID, codePayload)
			if updatedBytes, marshalErr := updatedEnv.ToBytes(); marshalErr == nil {
				msg.data = updatedBytes
			}

			select {
			case <-ctx.Done():
				return
			case <-r.done:
				return
			case r.broadcast <- msg:
			}
		}
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
	default:
	}

	if raw, err := ParseRawEnvelope(data); err == nil && raw.Type == EventCodeUpdate {
		select {
		case <-r.done:
			return
		case r.codeUpdateQueue <- broadcastMessage{data: data, senderID: senderID, isRemote: false}:
			return
		}
	}

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

		if r.saveQueue != nil {
			r.saveQueue.Close()
		}

		r.mu.Lock()
		defer r.mu.Unlock()

		for _, client := range r.clients {
			client.Close(websocket.StatusNormalClosure, "room closed")
		}
		r.clients = make(map[string]*Client)
		r.lastCodeState = nil
		r.pendingCodeState = nil
		r.codeVersion = 0
		r.logger.Info("room closed successfully")
	})
}
