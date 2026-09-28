package runner

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/mockinterviewai/code-runner/internal/config"
	"github.com/mockinterviewai/code-runner/internal/judge0"
)

// fakeJudge0 поднимает HTTP-сервер, повторяющий контракт Judge0 CE:
// POST /submissions возвращает токен, GET /submissions/{token} — результат.
// Первый опрос отдаёт промежуточный статус, чтобы проверить поллинг.
func fakeJudge0(t *testing.T, final map[string]any) (*judge0.Client, *judge0.Submission) {
	t.Helper()

	var captured judge0.Submission

	polls := 0

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method == http.MethodPost && r.URL.Path == "/submissions" {
			body, _ := io.ReadAll(r.Body)
			if err := json.Unmarshal(body, &captured); err != nil {
				t.Errorf("invalid submission payload: %v", err)
			}

			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(map[string]string{"token": "test-token"})

			return
		}

		polls++
		if polls == 1 {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"status": map[string]any{"id": judge0.StatusProcessing, "description": "Processing"},
			})

			return
		}

		_ = json.NewEncoder(w).Encode(final)
	}))
	t.Cleanup(server.Close)

	client := judge0.New(judge0.Options{
		BaseURL:          server.URL,
		PollInitialDelay: time.Millisecond,
		PollInterval:     time.Millisecond,
	})

	return client, &captured
}

func testConfig() *config.Config {
	return &config.Config{
		DefaultTimeout:   3 * time.Second,
		MaxTimeout:       5 * time.Second,
		MemoryLimitKB:    262144,
		MaxFileSizeKB:    4096,
		MaxCodeBytes:     64 * 1024,
		MaxStdinBytes:    64 * 1024,
		MaxOutputBytes:   64 * 1024,
		MaxProcesses:     64,
		MaxConcurrent:    4,
		QueueWaitTimeout: 2 * time.Second,
		ResultTimeout:    5 * time.Second,
		LanguageIDs:      config.DefaultLanguageIDs(),
	}
}

func b64(value string) string {
	return base64.StdEncoding.EncodeToString([]byte(value))
}

func TestRunSuccess(t *testing.T) {
	client, captured := fakeJudge0(t, map[string]any{
		"stdout":    b64("12\n"),
		"exit_code": 0,
		"time":      "0.142",
		"memory":    3072.0,
		"status":    map[string]any{"id": judge0.StatusAccepted, "description": "Accepted"},
	})

	service := NewService(testConfig(), client, slog.New(slog.DiscardHandler))

	result, err := service.Run(context.Background(), &Request{
		Language:  "TypeScript",
		Code:      "console.log(5 + 7);",
		Stdin:     "input\n",
		TimeoutMs: 2000,
	})
	if err != nil {
		t.Fatalf("Run returned an error: %v", err)
	}

	if result.Status != StatusSuccess {
		t.Errorf("status = %q, want %q", result.Status, StatusSuccess)
	}

	if result.Stdout != "12\n" {
		t.Errorf("stdout = %q, want %q", result.Stdout, "12\n")
	}

	if result.ExecutionTimeMs != 142 {
		t.Errorf("executionTimeMs = %d, want 142", result.ExecutionTimeMs)
	}

	if result.MemoryUsageBytes != 3072*1024 {
		t.Errorf("memoryUsageBytes = %d, want %d", result.MemoryUsageBytes, 3072*1024)
	}

	// Адаптер обязан кодировать код и stdin в base64 и переводить лимиты
	// в единицы Judge0: секунды для времени, килобайты для памяти.
	if captured.SourceCode != b64("console.log(5 + 7);") {
		t.Errorf("source_code was not base64-encoded: %q", captured.SourceCode)
	}

	if captured.Stdin != b64("input\n") {
		t.Errorf("stdin was not base64-encoded: %q", captured.Stdin)
	}

	if want := config.DefaultLanguageIDs()["typescript"]; captured.LanguageID != want {
		t.Errorf("language_id = %d, want %d", captured.LanguageID, want)
	}

	if captured.CPUTimeLimit != 2 {
		t.Errorf("cpu_time_limit = %v, want 2", captured.CPUTimeLimit)
	}

	if captured.EnableNetwork {
		t.Error("enable_network must always be false")
	}
}

func TestRunCompilationError(t *testing.T) {
	client, _ := fakeJudge0(t, map[string]any{
		"compile_output": b64("main.go:3:1: syntax error"),
		"status":         map[string]any{"id": judge0.StatusCompilationError, "description": "Compilation Error"},
	})

	service := NewService(testConfig(), client, slog.New(slog.DiscardHandler))

	result, err := service.Run(context.Background(), &Request{Language: "go", Code: "package main"})
	if err != nil {
		t.Fatalf("Run returned an error: %v", err)
	}

	if result.Status != StatusCompilationError {
		t.Errorf("status = %q, want %q", result.Status, StatusCompilationError)
	}

	// Judge0 кладёт вывод компилятора в отдельное поле: без переноса в stderr
	// пользователь увидел бы пустую консоль.
	if !strings.Contains(result.Stderr, "syntax error") {
		t.Errorf("stderr = %q, want it to contain the compiler output", result.Stderr)
	}
}

func TestRunTimeLimitExceeded(t *testing.T) {
	client, _ := fakeJudge0(t, map[string]any{
		"message":     b64("Time limit exceeded"),
		"exit_signal": 9,
		"status":      map[string]any{"id": judge0.StatusTimeLimitExceeded, "description": "Time Limit Exceeded"},
	})

	service := NewService(testConfig(), client, slog.New(slog.DiscardHandler))

	result, err := service.Run(context.Background(), &Request{Language: "python", Code: "while True: pass"})
	if err != nil {
		t.Fatalf("Run returned an error: %v", err)
	}

	if result.Status != StatusTimeLimitExceeded {
		t.Errorf("status = %q, want %q", result.Status, StatusTimeLimitExceeded)
	}

	if result.ExitCode != 137 {
		t.Errorf("exitCode = %d, want 137 (128 + SIGKILL)", result.ExitCode)
	}
}

func TestRunMemoryLimitExceeded(t *testing.T) {
	cfg := testConfig()

	client, _ := fakeJudge0(t, map[string]any{
		"memory": float64(cfg.MemoryLimitKB),
		"status": map[string]any{"id": judge0.StatusRuntimeErrorSIGSEGV, "description": "Runtime Error (SIGSEGV)"},
	})

	service := NewService(cfg, client, slog.New(slog.DiscardHandler))

	result, err := service.Run(context.Background(), &Request{Language: "cpp", Code: "int main(){}"})
	if err != nil {
		t.Fatalf("Run returned an error: %v", err)
	}

	// Отдельного статуса для OOM у Judge0 нет: превышение распознаётся по пику
	// потребления, иначе оно неотличимо от обычного SIGSEGV.
	if result.Status != StatusMemoryLimitExceeded {
		t.Errorf("status = %q, want %q", result.Status, StatusMemoryLimitExceeded)
	}
}

func TestRunOutputLimitExceeded(t *testing.T) {
	cfg := testConfig()
	cfg.MaxOutputBytes = 16

	client, _ := fakeJudge0(t, map[string]any{
		"stdout": b64(strings.Repeat("a", 100)),
		"status": map[string]any{"id": judge0.StatusAccepted, "description": "Accepted"},
	})

	service := NewService(cfg, client, slog.New(slog.DiscardHandler))

	result, err := service.Run(context.Background(), &Request{Language: "js", Code: "console.log(1)"})
	if err != nil {
		t.Fatalf("Run returned an error: %v", err)
	}

	if result.Status != StatusOutputLimitExceeded {
		t.Errorf("status = %q, want %q", result.Status, StatusOutputLimitExceeded)
	}

	if !strings.HasSuffix(result.Stdout, truncationMarker) {
		t.Errorf("stdout = %q, want it to end with the truncation marker", result.Stdout)
	}
}

func TestRunValidation(t *testing.T) {
	client, _ := fakeJudge0(t, map[string]any{
		"status": map[string]any{"id": judge0.StatusAccepted, "description": "Accepted"},
	})

	service := NewService(testConfig(), client, slog.New(slog.DiscardHandler))

	cases := map[string]*Request{
		"unknown language":  {Language: "brainfuck", Code: "+"},
		"empty code":        {Language: "python", Code: "   "},
		"timeout above max": {Language: "python", Code: "print(1)", TimeoutMs: 60000},
	}

	for name, req := range cases {
		t.Run(name, func(t *testing.T) {
			_, err := service.Run(context.Background(), req)

			var validationErr *ValidationError
			if !errors.As(err, &validationErr) {
				t.Fatalf("err = %v, want *ValidationError", err)
			}
		})
	}
}
