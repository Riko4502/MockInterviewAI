package sse

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestEnvelopeFrameFormat(t *testing.T) {
	env, err := NewEnvelope("1724500000000-0", EventNotificationNew, NotificationNewPayload{
		ID:       "ntf_1",
		Category: CategoryInfo,
		Title:    "Приглашение",
		Message:  "Вас пригласили на интервью",
		Read:     false,
	})
	if err != nil {
		t.Fatalf("failed to build envelope: %v", err)
	}

	frame := string(env.Frame())

	if !strings.HasPrefix(frame, "event: notification.new\n") {
		t.Errorf("frame must start with the event line, got: %q", frame)
	}

	if !strings.Contains(frame, "id: 1724500000000-0\n") {
		t.Errorf("frame must carry the redis stream id, got: %q", frame)
	}

	// Интервал переподключения отправляется один раз отдельным кадром при
	// открытии потока, поэтому в кадрах событий поля retry быть не должно.
	if strings.Contains(frame, "retry:") {
		t.Errorf("event frame must not repeat the retry hint, got: %q", frame)
	}

	if !strings.HasSuffix(frame, "\n\n") {
		t.Errorf("frame must be terminated by a blank line, got: %q", frame)
	}

	dataLine := ""
	for _, line := range strings.Split(frame, "\n") {
		if strings.HasPrefix(line, "data: ") {
			dataLine = strings.TrimPrefix(line, "data: ")
			break
		}
	}

	if dataLine == "" {
		t.Fatalf("frame must contain a data line, got: %q", frame)
	}

	var decoded struct {
		ID      string                 `json:"id"`
		Type    string                 `json:"type"`
		Payload NotificationNewPayload `json:"payload"`
	}

	if err := json.Unmarshal([]byte(dataLine), &decoded); err != nil {
		t.Fatalf("data line must be valid json: %v", err)
	}

	if decoded.ID != "1724500000000-0" || decoded.Type != "notification.new" {
		t.Errorf("unexpected envelope contents: %+v", decoded)
	}

	if decoded.Payload.Title != "Приглашение" {
		t.Errorf("payload was not preserved: %+v", decoded.Payload)
	}
}

func TestEnvelopeFrameOmitsEmptyID(t *testing.T) {
	// Общесистемные бродкасты не лежат в персональном стриме: кадр без поля id
	// не должен сбивать курсор Last-Event-ID у клиента.
	env, err := NewEnvelope("", EventSystemBroadcast, SystemBroadcastPayload{
		Severity: "warning",
		Message:  "Плановые технические работы",
	})
	if err != nil {
		t.Fatalf("failed to build envelope: %v", err)
	}

	frame := string(env.Frame())

	if strings.Contains(frame, "\nid: ") || strings.HasPrefix(frame, "id: ") {
		t.Errorf("frame must not contain an id field, got: %q", frame)
	}
}

func TestCommentFrameIsSingleLine(t *testing.T) {
	frame := string(CommentFrame("ping 1724500000000\nevent: injected"))

	if strings.Count(frame, "\n") != 2 {
		t.Errorf("comment frame must not allow injected line breaks, got: %q", frame)
	}

	if !strings.HasPrefix(frame, ": ") {
		t.Errorf("comment frame must start with ': ', got: %q", frame)
	}
}

func TestIsValidStreamID(t *testing.T) {
	valid := []string{"0", "0-0", "1724500000000-0", "1724500000000-42"}
	for _, id := range valid {
		if !IsValidStreamID(id) {
			t.Errorf("expected %q to be a valid stream id", id)
		}
	}

	// Значения ниже приходят из заголовка Last-Event-ID и не должны попадать в XRANGE.
	invalid := []string{"", "$", "+", "-", "*", "1724500000000-", "-0", "1724500000000-0 x", "abc", strings.Repeat("1", 41)}
	for _, id := range invalid {
		if IsValidStreamID(id) {
			t.Errorf("expected %q to be rejected as a stream id", id)
		}
	}
}

func TestCompareStreamIDsIsNumeric(t *testing.T) {
	// Лексикографически "9-0" > "10-0", численно — наоборот.
	if CompareStreamIDs("9-0", "10-0") != -1 {
		t.Error("stream ids must be compared numerically, not lexicographically")
	}

	if CompareStreamIDs("100-1", "100-2") != -1 {
		t.Error("sequence part must be taken into account")
	}

	if CompareStreamIDs("100-2", "100-2") != 0 {
		t.Error("identical ids must compare as equal")
	}

	if CompareStreamIDs("100-3", "100-2") != 1 {
		t.Error("greater sequence must compare as greater")
	}
}

func TestNormalizePayloadRejectsBrokenJSON(t *testing.T) {
	if got := string(normalizePayload([]byte("{broken"))); got != "null" {
		t.Errorf("malformed payload must be replaced with null, got %q", got)
	}

	if got := string(normalizePayload([]byte(`{"a":1}`))); got != `{"a":1}` {
		t.Errorf("valid payload must be passed through, got %q", got)
	}
}

// TestRetryFrameCarriesInterval фиксирует, что интервал переподключения
// по-прежнему доезжает до клиента: он отправляется единственный раз отдельным
// кадром при открытии потока, а не повторяется в каждом событии.
func TestRetryFrameCarriesInterval(t *testing.T) {
	if got := string(RetryFrame(3000)); got != "retry: 3000\n\n" {
		t.Errorf("unexpected retry frame: %q", got)
	}
}
