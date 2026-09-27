// Package runner содержит доменную логику запуска кода: валидацию запроса,
// ограничение параллелизма и трансляцию ответа Judge0 в контракт POST /api/v1/run.
package runner

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
)

// Статусы выполнения из контракта API (docs/tasks/code-runner.md, раздел 4).
const (
	StatusSuccess             = "SUCCESS"
	StatusRuntimeError        = "RUNTIME_ERROR"
	StatusCompilationError    = "COMPILATION_ERROR"
	StatusTimeLimitExceeded   = "TIME_LIMIT_EXCEEDED"
	StatusMemoryLimitExceeded = "MEMORY_LIMIT_EXCEEDED"
	StatusOutputLimitExceeded = "OUTPUT_LIMIT_EXCEEDED"
	StatusInternalError       = "INTERNAL_ERROR"
)

// truncationMarker дописывается к обрезанному выводу, чтобы в редакторе было
// видно, что часть вывода потеряна, а не программа так завершилась.
const truncationMarker = "\n[output truncated]"

// Request — входные данные запуска.
type Request struct {
	Language  string `json:"language"`
	Code      string `json:"code"`
	Stdin     string `json:"stdin"`
	TimeoutMs int    `json:"timeoutMs"`
}

// Result — результат запуска в формате ответа API.
type Result struct {
	Status           string `json:"status"`
	Stdout           string `json:"stdout"`
	Stderr           string `json:"stderr"`
	ExitCode         int    `json:"exitCode"`
	ExecutionTimeMs  int64  `json:"executionTimeMs"`
	MemoryUsageBytes int64  `json:"memoryUsageBytes"`
}

// ValidationError — запрос отклонён до отправки в Judge0 (HTTP 400).
type ValidationError struct {
	Message string
}

// Error реализует интерфейс error.
func (e *ValidationError) Error() string {
	return e.Message
}

// ErrQueueFull возвращается, когда за QueueWaitTimeout не освободился слот
// в пуле параллельных запусков (HTTP 429).
var ErrQueueFull = errors.New("execution queue is full")

// ErrResultTimeout возвращается, когда Judge0 не отдал финальный статус
// за отведённый бюджет ожидания (HTTP 504). От TIME_LIMIT_EXCEEDED отличается
// тем, что лимит исчерпан на стороне очереди Judge0, а не пользовательским кодом.
var ErrResultTimeout = errors.New("timed out waiting for judge0 result")

// newValidationError — хелпер для краткости в Validate.
func newValidationError(format string, args ...any) *ValidationError {
	return &ValidationError{Message: fmt.Sprintf(format, args...)}
}

// languageAliases приводит написания языка из редактора (Monaco отдаёт "js",
// "c++") к каноническим ключам конфигурации.
var languageAliases = map[string]string{
	"js":         "javascript",
	"node":       "javascript",
	"nodejs":     "javascript",
	"ts":         "typescript",
	"py":         "python",
	"python3":    "python",
	"c++":        "cpp",
	"golang":     "go",
	"javascript": "javascript",
	"typescript": "typescript",
	"cpp":        "cpp",
	"go":         "go",
	"java":       "java",
}

// NormalizeLanguage приводит язык к каноническому ключу LanguageIDs.
func NormalizeLanguage(language string) string {
	normalized := strings.ToLower(strings.TrimSpace(language))
	if canonical, ok := languageAliases[normalized]; ok {
		return canonical
	}

	return normalized
}

// sortedKeys возвращает отсортированный список языков для детерминированных
// сообщений об ошибке и /languages.
func sortedKeys(ids map[string]int) []string {
	languages := make([]string, 0, len(ids))
	for name := range ids {
		languages = append(languages, name)
	}

	sort.Strings(languages)

	return languages
}

// truncate обрезает вывод до limit байт, дописывая маркер.
// Второе возвращаемое значение сообщает, была ли обрезка.
func truncate(value string, limit int) (string, bool) {
	if len(value) <= limit {
		return value, false
	}

	return value[:limit] + truncationMarker, true
}

// ensureContext добавляет к ошибке отмены контекста доменную причину.
func wrapContextError(err error) error {
	if errors.Is(err, context.DeadlineExceeded) {
		return ErrResultTimeout
	}

	return err
}
