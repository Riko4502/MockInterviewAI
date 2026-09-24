package ws

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"sort"
	"strings"
	"testing"
	"time"
)

// BenchmarkRoomBroadcast измеряет пропускную способность и накладные расходы ретрансляции
// входящего пакета yjs.update локальным сокетам комнаты (NFR-1).
func BenchmarkRoomBroadcast(b *testing.B) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	room := NewRoom("bench-room", nil, nil, logger, nil)

	// Создаем участников: sender (Candidate) и receiver (Interviewer)
	clientSender := NewClient("client-sender", "user-sender", "Candidate", "candidate", room.ID, nil, room, logger)
	clientReceiver := NewClient("client-receiver", "user-receiver", "Interviewer", "interviewer", room.ID, nil, room, logger)

	room.mu.Lock()
	room.clients[clientSender.ID] = clientSender
	room.clients[clientReceiver.ID] = clientReceiver
	room.mu.Unlock()

	// Формируем типичный 1 КБ yjs.update пакет
	updatePayload := YjsUpdatePayload{
		TaskKey:  "two-sum:typescript",
		UpdateID: "upd-bench-1",
		Data:     strings.Repeat("A", 1024),
	}
	env := NewEnvelope(EventYjsUpdate, room.ID, "req-bench-1", updatePayload)
	data, err := env.ToBytes()
	if err != nil {
		b.Fatalf("failed to serialize yjs.update envelope: %v", err)
	}

	msg := broadcastMessage{
		data:     data,
		senderID: clientSender.ID,
		isRemote: false,
	}

	
	b.ReportAllocs()

	ctx := context.Background()
	for b.Loop() {
		room.handleBroadcast(ctx, msg)
		room.SaveQueue().CommitBatch(updatePayload.TaskKey, 1)

		// Очищаем sendCh для предотвращения переполнения буфера
		select {
		case <-clientReceiver.sendCh:
		default:
		}
		select {
		case <-clientSender.sendCh:
		default:
		}
	}
}

// TestNFR1_RoomBroadcast_P99 экспериментально проверяет гипотезу NFR-1:
// Задержка обработки и рассылки yjs.update локальным сокетам комнаты P99 < 10 мс.
func TestNFR1_RoomBroadcast_P99(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	room := NewRoom("bench-p99-room", nil, nil, logger, nil)

	clientSender := NewClient("client-s", "user-s", "Alice", "candidate", room.ID, nil, room, logger)
	clientReceiver := NewClient("client-r", "user-r", "Bob", "interviewer", room.ID, nil, room, logger)

	room.mu.Lock()
	room.clients[clientSender.ID] = clientSender
	room.clients[clientReceiver.ID] = clientReceiver
	room.mu.Unlock()

	env := NewEnvelope(EventYjsUpdate, room.ID, "req-p99", YjsUpdatePayload{
		TaskKey:  "two-sum:typescript",
		UpdateID: "upd-p99",
		Data:     strings.Repeat("A", 1024),
	})
	data, err := env.ToBytes()
	if err != nil {
		t.Fatalf("failed to create envelope: %v", err)
	}

	msg := broadcastMessage{
		data:     data,
		senderID: clientSender.ID,
		isRemote: false,
	}

	const iterations = 5000
	latencies := make([]time.Duration, iterations)
	ctx := context.Background()

	for i := 0; i < iterations; i++ {
		start := time.Now()
		room.handleBroadcast(ctx, msg)
		latencies[i] = time.Since(start)
		room.SaveQueue().CommitBatch("two-sum:typescript", 1)

		// Сбрасываем буферы
		select {
		case <-clientReceiver.sendCh:
		default:
		}
		select {
		case <-clientSender.sendCh:
		default:
		}
	}

	sort.Slice(latencies, func(i, j int) bool {
		return latencies[i] < latencies[j]
	})

	p50 := latencies[iterations*50/100]
	p90 := latencies[iterations*90/100]
	p99 := latencies[iterations*99/100]

	t.Logf("NFR-1 Latency Results (iterations=%d): P50=%v, P90=%v, P99=%v", iterations, p50, p90, p99)

	const maxP99 = 10 * time.Millisecond
	if p99 >= maxP99 {
		t.Fatalf("NFR-1 VIOLATION: P99 latency %v exceeded maximum threshold of %v", p99, maxP99)
	}
}

// BenchmarkYjsEnvelopeValidation измеряет задержку и аллокации валидации конверта Yjs (NFR-2).
// Проверяет санитизацию полезной нагрузки размером 64 КБ (87 384 байт Base64).
func BenchmarkYjsEnvelopeValidation(b *testing.B) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	client := NewClient("client-val", "user-val", "Alice", "candidate", "val-room", nil, nil, logger)

	// Максимально допустимый размер Base64 (64 КБ бинарных данных = 87 384 символа)
	maxData := strings.Repeat("A", maxYjsBase64Length)

	payload := YjsUpdatePayload{
		TaskKey:  "valid-palindrome:typescript",
		UpdateID: "upd-val-1",
		Data:     maxData,
	}
	env := NewEnvelope(EventYjsUpdate, "val-room", "req-val-1", payload)
	rawBytes, err := json.Marshal(env)
	if err != nil {
		b.Fatalf("failed to marshal envelope: %v", err)
	}

	raw, err := ParseRawEnvelope(rawBytes)
	if err != nil {
		b.Fatalf("failed to parse raw envelope: %v", err)
	}

	
	b.ReportAllocs()

	for b.Loop() {
		sanitized, sErr := client.sanitizeIncomingPayload(raw)
		if sErr != nil {
			b.Fatalf("unexpected validation error: %v", sErr)
		}
		if len(sanitized) == 0 {
			b.Fatalf("expected non-empty sanitized bytes")
		}
	}
}

// BenchmarkYjsEnvelopeValidation_Awareness измеряет валидацию конвертов yjs.awareness.
func BenchmarkYjsEnvelopeValidation_Awareness(b *testing.B) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	client := NewClient("client-val-aw", "user-val-aw", "Bob", "interviewer", "val-room", nil, nil, logger)

	payload := YjsAwarenessPayload{
		TaskKey: "two-sum:python",
		Data:    strings.Repeat("B", 1024),
	}
	env := NewEnvelope(EventYjsAwareness, "val-room", "req-aw-1", payload)
	rawBytes, err := json.Marshal(env)
	if err != nil {
		b.Fatalf("failed to marshal awareness envelope: %v", err)
	}

	raw, err := ParseRawEnvelope(rawBytes)
	if err != nil {
		b.Fatalf("failed to parse raw envelope: %v", err)
	}

	
	b.ReportAllocs()

	for b.Loop() {
		sanitized, sErr := client.sanitizeIncomingPayload(raw)
		if sErr != nil {
			b.Fatalf("unexpected validation error: %v", sErr)
		}
		if len(sanitized) == 0 {
			b.Fatalf("expected non-empty sanitized bytes")
		}
	}
}
