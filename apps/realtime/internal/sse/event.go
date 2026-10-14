package sse

import (
	"bytes"
	"encoding/json"
	"strconv"
	"strings"
	"time"
)

//go:generate pnpm --filter @packages/dto run generate:go

// Типы событий и визуальные severity объявлены в events_gen.go: они
// генерируются из словаря packages/dto/src/realtime/sse-event.dto.ts,
// поэтому правка констант вручную расходилась бы с продюсерами в apps/api
// (ADR-004:86). Файл коммитится, и go build не требует Node.

// String возвращает строковое представление типа события.
func (e EventType) String() string {
	return string(e)
}

// Envelope — канонический конверт SSE-события (BaseSSEEnvelope на стороне клиента).
//
// Поле ID содержит Redis Stream ID и используется браузером как Last-Event-ID.
// Для событий, которых нет в персональном стриме (общесистемные бродкасты,
// служебные кадры), ID остается пустым: тогда строка "id:" в кадр не пишется
// и клиентский курсор восстановления не сбивается несуществующим идентификатором.
type Envelope struct {
	ID        string          `json:"id,omitempty"`
	Type      EventType       `json:"type"`
	Timestamp time.Time       `json:"timestamp"`
	Payload   json.RawMessage `json:"payload"`
}

// NewEnvelope собирает конверт события, сериализуя переданный payload в JSON.
func NewEnvelope(id string, eventType EventType, payload any) (*Envelope, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	return &Envelope{
		ID:        id,
		Type:      eventType,
		Timestamp: time.Now().UTC(),
		Payload:   raw,
	}, nil
}

// Frame формирует wire-кадр SSE строго по стандарту W3C:
//
//	event: <EventType>\n
//	id: <RedisStreamID>\n
//	data: <JSON Payload>\n\n
//
// Поле retry в кадры событий не пишется: клиент запоминает значение из
// отдельного кадра, отправляемого один раз при открытии потока (RetryFrame),
// и повтор в каждом событии только увеличивает объем трафика.
func (e *Envelope) Frame() []byte {
	body, err := json.Marshal(e)
	if err != nil {
		// Конверт состоит из примитивов и json.RawMessage, полученного из
		// валидного JSON, поэтому ошибка здесь означает поврежденный payload.
		body = []byte(`{"type":"` + string(e.Type) + `","payload":null}`)
	}

	var buf bytes.Buffer
	buf.Grow(len(body) + 64)

	buf.WriteString("event: ")
	buf.WriteString(string(e.Type))
	buf.WriteByte('\n')

	if e.ID != "" {
		buf.WriteString("id: ")
		buf.WriteString(e.ID)
		buf.WriteByte('\n')
	}

	// json.Marshal не выводит сырых переносов строк, но многострочный data
	// разбивается на несколько строк "data:" — это защита от рассинхронизации
	// парсера, если payload когда-либо начнет приходить в другом формате.
	writeDataLines(&buf, body)
	buf.WriteByte('\n')

	return buf.Bytes()
}

// writeDataLines записывает тело события, разбивая его на кадры "data:" по переносам строк.
func writeDataLines(buf *bytes.Buffer, body []byte) {
	normalized := strings.ReplaceAll(string(body), "\r\n", "\n")
	normalized = strings.ReplaceAll(normalized, "\r", "\n")

	for line := range strings.SplitSeq(normalized, "\n") {
		buf.WriteString("data: ")
		buf.WriteString(line)
		buf.WriteByte('\n')
	}
}

// CommentFrame формирует служебный комментарий SSE (например, heartbeat ": ping <ts>").
// Комментарии игнорируются парсером EventSource, но удерживают соединение живым
// и пробивают буферы промежуточных прокси.
func CommentFrame(text string) []byte {
	sanitized := strings.NewReplacer("\r", " ", "\n", " ").Replace(text)
	return []byte(": " + sanitized + "\n\n")
}

// RetryFrame формирует отдельный кадр с интервалом переподключения клиента.
func RetryFrame(retryMs int) []byte {
	return []byte("retry: " + strconv.Itoa(retryMs) + "\n\n")
}

// IsValidStreamID проверяет, что строка является корректным Redis Stream ID вида
// "<ms>-<seq>" или "<ms>". Значение приходит из заголовка Last-Event-ID, то есть
// полностью контролируется клиентом, и без валидации попадало бы в аргументы XRANGE.
func IsValidStreamID(id string) bool {
	if id == "" || len(id) > 40 {
		return false
	}

	msPart, seqPart, hasSeq := strings.Cut(id, "-")
	if !isDigits(msPart) {
		return false
	}

	if hasSeq && !isDigits(seqPart) {
		return false
	}

	return true
}

func isDigits(s string) bool {
	if s == "" {
		return false
	}

	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}

	return true
}

// CompareStreamIDs сравнивает два Redis Stream ID покомпонентно и возвращает
// -1, 0 или 1. Лексикографическое сравнение здесь неприменимо: "9-0" больше
// "10-0" как строка, но меньше как идентификатор потока.
func CompareStreamIDs(a, b string) int {
	aMS, aSeq := splitStreamID(a)
	bMS, bSeq := splitStreamID(b)

	switch {
	case aMS < bMS:
		return -1
	case aMS > bMS:
		return 1
	case aSeq < bSeq:
		return -1
	case aSeq > bSeq:
		return 1
	default:
		return 0
	}
}

func splitStreamID(id string) (ms, seq int64) {
	msPart, seqPart, _ := strings.Cut(id, "-")
	ms, _ = strconv.ParseInt(msPart, 10, 64)
	seq, _ = strconv.ParseInt(seqPart, 10, 64)

	return ms, seq
}
