package runner

import (
	"context"
	"log/slog"
	"math"
	"strings"
	"time"

	"github.com/mockinterviewai/code-runner/internal/config"
	"github.com/mockinterviewai/code-runner/internal/judge0"
)

// executor — часть API Judge0, которая нужна сервису. Интерфейс объявлен здесь
// (на стороне потребителя), чтобы подменять клиента в тестах.
type executor interface {
	Execute(ctx context.Context, sub *judge0.Submission) (*judge0.Result, error)
}

// Service выполняет код через Judge0 с учётом лимитов из конфигурации.
type Service struct {
	cfg    *config.Config
	judge  executor
	logger *slog.Logger

	// slots — семафор на число одновременных запусков. Judge0 держит
	// собственную очередь, но без ограничения на входе сервис принимал бы
	// неограниченно много запросов и копил бы горутины в ожидании результата.
	slots chan struct{}
}

// NewService создаёт сервис запуска кода.
func NewService(cfg *config.Config, judge executor, logger *slog.Logger) *Service {
	return &Service{
		cfg:    cfg,
		judge:  judge,
		logger: logger,
		slots:  make(chan struct{}, cfg.MaxConcurrent),
	}
}

// Languages возвращает поддерживаемые языки в детерминированном порядке.
func (s *Service) Languages() []string {
	return sortedKeys(s.cfg.LanguageIDs)
}

// Run валидирует запрос, выполняет код в Judge0 и возвращает результат.
func (s *Service) Run(ctx context.Context, req *Request) (*Result, error) {
	languageID, timeout, err := s.validate(req)
	if err != nil {
		return nil, err
	}

	release, err := s.acquireSlot(ctx)
	if err != nil {
		return nil, err
	}
	defer release()

	// Бюджет ожидания результата покрывает очередь Judge0, компиляцию
	// и выполнение — он всегда больше пользовательского timeout.
	runCtx, cancel := context.WithTimeout(ctx, s.cfg.ResultTimeout)
	defer cancel()

	result, err := s.judge.Execute(runCtx, s.buildSubmission(req, languageID, timeout))
	if err != nil {
		return nil, wrapContextError(err)
	}

	return s.toResult(result), nil
}

// validate проверяет запрос и возвращает language_id Judge0 и эффективный таймаут.
func (s *Service) validate(req *Request) (int, time.Duration, error) {
	language := NormalizeLanguage(req.Language)
	if language == "" {
		return 0, 0, newValidationError("language is required")
	}

	languageID, ok := s.cfg.LanguageIDs[language]
	if !ok {
		return 0, 0, newValidationError(
			"unsupported language %q, supported: %s",
			req.Language, strings.Join(s.Languages(), ", "),
		)
	}

	if strings.TrimSpace(req.Code) == "" {
		return 0, 0, newValidationError("code is required")
	}

	if len(req.Code) > s.cfg.MaxCodeBytes {
		return 0, 0, newValidationError("code exceeds the limit of %d bytes", s.cfg.MaxCodeBytes)
	}

	if len(req.Stdin) > s.cfg.MaxStdinBytes {
		return 0, 0, newValidationError("stdin exceeds the limit of %d bytes", s.cfg.MaxStdinBytes)
	}

	timeout := s.cfg.DefaultTimeout

	if req.TimeoutMs > 0 {
		timeout = time.Duration(req.TimeoutMs) * time.Millisecond
	}

	if timeout > s.cfg.MaxTimeout {
		return 0, 0, newValidationError("timeoutMs exceeds the limit of %d ms", s.cfg.MaxTimeout.Milliseconds())
	}

	return languageID, timeout, nil
}

// acquireSlot занимает слот пула и возвращает функцию освобождения.
func (s *Service) acquireSlot(ctx context.Context) (func(), error) {
	release := func() { <-s.slots }

	// Быстрый путь для незагруженного сервиса. Без него при RUN_QUEUE_WAIT_MS=0
	// таймер готов одновременно с отправкой в канал, и select выбирает между
	// ними случайно — часть запросов отклонялась бы при свободных слотах.
	select {
	case s.slots <- struct{}{}:
		return release, nil
	default:
	}

	timer := time.NewTimer(s.cfg.QueueWaitTimeout)
	defer timer.Stop()

	select {
	case s.slots <- struct{}{}:
		return release, nil
	case <-timer.C:
		return nil, ErrQueueFull
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// buildSubmission переводит доменный запрос и лимиты конфигурации в submission Judge0.
func (s *Service) buildSubmission(req *Request, languageID int, timeout time.Duration) *judge0.Submission {
	cpuSeconds := timeout.Seconds()

	return &judge0.Submission{
		SourceCode:   req.Code,
		LanguageID:   languageID,
		Stdin:        req.Stdin,
		CPUTimeLimit: cpuSeconds,

		// Дополнительное время сверх CPU-лимита, чтобы isolate успел корректно
		// снять процесс и отдать статус, а не оборвал его на полуслове.
		CPUExtraTime: 0.5,

		// Wall-time считается вместе с компиляцией и ожиданием stdin, поэтому
		// он заметно больше CPU-лимита; иначе компилируемые языки падали бы
		// по таймауту ещё до старта программы.
		WallTimeLimit: cpuSeconds + 5,

		MemoryLimit:              s.cfg.MemoryLimitKB,
		MaxFileSize:              s.cfg.MaxFileSizeKB,
		MaxProcessesAndOrThreads: s.cfg.MaxProcesses,
		EnableNetwork:            false,
	}
}

// toResult транслирует ответ Judge0 в контракт API.
func (s *Service) toResult(raw *judge0.Result) *Result {
	stdout := deref(raw.Stdout)
	stderr := deref(raw.Stderr)
	compileOutput := deref(raw.CompileOutput)
	message := deref(raw.Message)

	status := s.mapStatus(raw)

	// Для ошибок компиляции Judge0 не заполняет stderr: вывод компилятора
	// лежит в отдельном поле, и без этого пользователь увидел бы пустую консоль.
	if status == StatusCompilationError && stderr == "" {
		stderr = compileOutput
	}

	// message несёт причину снятия процесса (Time limit exceeded, Killed
	// и т.п.) — без него TLE и OOM выглядят как молчаливое завершение.
	if stderr == "" && message != "" {
		stderr = message
	}

	stdout, stdoutTruncated := truncate(stdout, s.cfg.MaxOutputBytes)
	stderr, stderrTruncated := truncate(stderr, s.cfg.MaxOutputBytes)

	// Обрезка не должна перекрывать более специфичный статус: если программа
	// упала, важнее показать RUNTIME_ERROR, а не факт усечения вывода.
	if (stdoutTruncated || stderrTruncated) && status == StatusSuccess {
		status = StatusOutputLimitExceeded
	}

	return &Result{
		Status:           status,
		Stdout:           stdout,
		Stderr:           stderr,
		ExitCode:         exitCode(raw, status),
		ExecutionTimeMs:  int64(math.Round(raw.TimeSeconds() * 1000)),
		MemoryUsageBytes: int64(raw.MemoryKB() * 1024),
	}
}

// mapStatus переводит статус Judge0 в статус контракта API.
func (s *Service) mapStatus(raw *judge0.Result) string {
	switch raw.Status.ID {
	case judge0.StatusAccepted, judge0.StatusWrongAnswer:
		// Wrong Answer недостижим: сервис не передаёт expected_output,
		// но статус трактуется как успешное завершение с кодом 0.
		return StatusSuccess

	case judge0.StatusTimeLimitExceeded:
		return StatusTimeLimitExceeded

	case judge0.StatusCompilationError:
		return StatusCompilationError

	case judge0.StatusInternalError, judge0.StatusExecFormatError:
		return StatusInternalError

	default:
		if s.isMemoryLimit(raw) {
			return StatusMemoryLimitExceeded
		}

		return StatusRuntimeError
	}
}

// isMemoryLimit отличает OOM от обычного падения. Judge0 не выделяет для
// превышения памяти отдельный статус: isolate снимает процесс сигналом и
// отдаёт Runtime Error, поэтому решение принимается по фактическому пику
// потребления и тексту message.
func (s *Service) isMemoryLimit(raw *judge0.Result) bool {
	if message := deref(raw.Message); strings.Contains(strings.ToLower(message), "memory") {
		return true
	}

	limitKB := float64(s.cfg.MemoryLimitKB)

	return limitKB > 0 && raw.MemoryKB() >= limitKB
}

// exitCode восстанавливает код возврата: Judge0 отдаёт null для процессов,
// снятых сигналом, и для ошибок компиляции.
func exitCode(raw *judge0.Result, status string) int {
	if raw.ExitCode != nil {
		return *raw.ExitCode
	}

	if raw.ExitSignal != nil && *raw.ExitSignal > 0 {
		// Соглашение POSIX-шелла: процесс, снятый сигналом N, даёт 128+N.
		return 128 + *raw.ExitSignal
	}

	if status == StatusSuccess {
		return 0
	}

	return 1
}

func deref(value *string) string {
	if value == nil {
		return ""
	}

	return *value
}
