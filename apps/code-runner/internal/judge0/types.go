// Package judge0 содержит HTTP-адаптер к Judge0 CE: создание submission,
// опрос результата и справочник языков.
//
// Адаптер намеренно ничего не знает о доменных статусах сервиса
// (SUCCESS / RUNTIME_ERROR / ...) и отдаёт сырой ответ Judge0 —
// трансляция в контракт POST /api/v1/run живёт в internal/runner.
package judge0

import (
	"fmt"
	"strconv"
)

// Идентификаторы статусов Judge0 CE (GET /statuses).
const (
	StatusInQueue             = 1
	StatusProcessing          = 2
	StatusAccepted            = 3
	StatusWrongAnswer         = 4
	StatusTimeLimitExceeded   = 5
	StatusCompilationError    = 6
	StatusRuntimeErrorSIGSEGV = 7
	StatusRuntimeErrorSIGXFSZ = 8
	StatusRuntimeErrorSIGFPE  = 9
	StatusRuntimeErrorSIGABRT = 10
	StatusRuntimeErrorNZEC    = 11
	StatusRuntimeErrorOther   = 12
	StatusInternalError       = 13
	StatusExecFormatError     = 14
)

// Submission — тело запроса POST /submissions.
//
// Поля source_code/stdin передаются в base64 (клиент кодирует их сам,
// запрос всегда идёт с base64_encoded=true): пользовательский код может
// содержать любые байты, и сырой JSON на нём ломается.
type Submission struct {
	SourceCode string `json:"source_code"`
	LanguageID int    `json:"language_id"`
	Stdin      string `json:"stdin,omitempty"`

	// Лимиты в единицах Judge0: секунды для времени, килобайты для памяти.
	CPUTimeLimit             float64 `json:"cpu_time_limit,omitempty"`
	CPUExtraTime             float64 `json:"cpu_extra_time,omitempty"`
	WallTimeLimit            float64 `json:"wall_time_limit,omitempty"`
	MemoryLimit              int     `json:"memory_limit,omitempty"`
	MaxFileSize              int     `json:"max_file_size,omitempty"`
	MaxProcessesAndOrThreads int     `json:"max_processes_and_or_threads,omitempty"`

	// enable_network всегда false: песочница не должна ходить в сеть.
	EnableNetwork bool `json:"enable_network"`
}

// Status — статус submission в ответе Judge0.
type Status struct {
	ID          int    `json:"id"`
	Description string `json:"description"`
}

// Result — ответ GET /submissions/{token}.
//
// Указатели, а не значения: Judge0 отдаёт null для полей, которые
// неприменимы к конкретному запуску (нет вывода, нет кода возврата).
type Result struct {
	Token         string  `json:"token"`
	Stdout        *string `json:"stdout"`
	Stderr        *string `json:"stderr"`
	CompileOutput *string `json:"compile_output"`
	Message       *string `json:"message"`
	ExitCode      *int    `json:"exit_code"`
	ExitSignal    *int    `json:"exit_signal"`

	// Time — время CPU в секундах, строкой ("0.002"); Memory — килобайты.
	Time   *string  `json:"time"`
	Memory *float64 `json:"memory"`

	Status Status `json:"status"`
}

// IsFinal сообщает, завершил ли Judge0 обработку submission.
// Статусы 1 (In Queue) и 2 (Processing) — промежуточные.
func (r *Result) IsFinal() bool {
	return r.Status.ID > StatusProcessing
}

// TimeSeconds возвращает время CPU в секундах; 0, если Judge0 его не вернул.
func (r *Result) TimeSeconds() float64 {
	if r == nil || r.Time == nil {
		return 0
	}

	seconds, err := strconv.ParseFloat(*r.Time, 64)
	if err != nil {
		return 0
	}

	return seconds
}

// MemoryKB возвращает пиковое потребление памяти в килобайтах.
func (r *Result) MemoryKB() float64 {
	if r == nil || r.Memory == nil {
		return 0
	}

	return *r.Memory
}

// Language — элемент ответа GET /languages.
type Language struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// APIError — ответ Judge0 с не-успешным HTTP-кодом.
type APIError struct {
	StatusCode int
	Body       string
}

// Error реализует интерфейс error.
func (e *APIError) Error() string {
	return fmt.Sprintf("judge0 responded with status %d: %s", e.StatusCode, e.Body)
}
