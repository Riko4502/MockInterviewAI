// Package config загружает и валидирует конфигурацию сервиса выполнения кода.
package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// Config содержит строго типизированные параметры конфигурации сервиса.
type Config struct {
	Port            string
	Host            string
	Environment     string
	LogLevel        string
	ShutdownTimeout time.Duration
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration

	// AuthToken — общий секрет для внутренних вызовов из apps/api и apps/realtime
	// (заголовок X-Internal-Token). Сервис исполняет произвольный код, поэтому
	// в production токен обязателен (fail-closed): без него сервис не стартует.
	AuthToken string

	// Judge0Deadline ограничивает один HTTP-запрос к Judge0 (создание submission,
	// одна итерация опроса). Не путать с ResultTimeout — общим бюджетом ожидания
	// результата, который покрывает очередь, компиляцию и выполнение.
	Judge0URL        string
	Judge0AuthHeader string
	Judge0AuthToken  string
	Judge0Deadline   time.Duration

	// Лимиты выполнения (см. docs/tasks/code-runner.md, раздел 3).
	DefaultTimeout   time.Duration
	MaxTimeout       time.Duration
	MemoryLimitKB    int
	MaxFileSizeKB    int
	MaxCodeBytes     int
	MaxStdinBytes    int
	MaxOutputBytes   int
	MaxProcesses     int
	MaxConcurrent    int
	QueueWaitTimeout time.Duration
	ResultTimeout    time.Duration
	PollInitialDelay time.Duration
	PollInterval     time.Duration

	// LanguageIDs сопоставляет канонический язык сервиса с language_id Judge0.
	// Значения по умолчанию заданы для Judge0 CE 1.13.1 и переопределяются
	// переменной JUDGE0_LANGUAGE_IDS без пересборки образа.
	LanguageIDs map[string]int
}

// DefaultLanguageIDs возвращает language_id из стандартной поставки Judge0 CE 1.13.1.
// При обновлении Judge0 идентификаторы сверяются с GET /languages (сервис делает
// это на старте и пишет предупреждение) и переопределяются JUDGE0_LANGUAGE_IDS.
func DefaultLanguageIDs() map[string]int {
	return map[string]int{
		"javascript": 93, // JavaScript (Node.js 18.15.0)
		"typescript": 94, // TypeScript (5.0.3)
		"python":     92, // Python (3.11.2)
		"go":         95, // Go (1.18.5)
		"cpp":        54, // C++ (GCC 9.2.0)
		"java":       91, // Java (JDK 17.0.6)
	}
}

// Load загружает настройки из переменных окружения и .env файлов.
func Load() (*Config, error) {
	loadDotEnvs()

	// Prod-контейнер задаёт ENVIRONMENT=production, локально используется ENV.
	env := getEnv("ENV", getEnv("ENVIRONMENT", "development"))

	authToken := getEnv("CODE_RUNNER_AUTH_TOKEN", "")
	if authToken == "" && env == "production" {
		return nil, fmt.Errorf(
			"CODE_RUNNER_AUTH_TOKEN is required in production: the service executes arbitrary user code and must not be callable anonymously",
		)
	}

	shutdownSec, err := getEnvInt("SHUTDOWN_TIMEOUT_SECONDS", 10)
	if err != nil {
		return nil, fmt.Errorf("invalid SHUTDOWN_TIMEOUT_SECONDS: %w", err)
	}

	readSec, err := getEnvInt("READ_TIMEOUT_SECONDS", 15)
	if err != nil {
		return nil, fmt.Errorf("invalid READ_TIMEOUT_SECONDS: %w", err)
	}

	writeSec, err := getEnvInt("WRITE_TIMEOUT_SECONDS", 60)
	if err != nil {
		return nil, fmt.Errorf("invalid WRITE_TIMEOUT_SECONDS: %w", err)
	}

	lim, err := loadLimits()
	if err != nil {
		return nil, err
	}

	languageIDs, err := loadLanguageIDs()
	if err != nil {
		return nil, err
	}

	cfg := &Config{
		Port:            getEnv("CODE_RUNNER_PORT", getEnv("PORT", "8090")),
		Host:            getEnv("CODE_RUNNER_HOST", getEnv("HOST", "0.0.0.0")),
		Environment:     env,
		LogLevel:        getEnv("LOG_LEVEL", "debug"),
		ShutdownTimeout: time.Duration(shutdownSec) * time.Second,
		ReadTimeout:     time.Duration(readSec) * time.Second,
		WriteTimeout:    time.Duration(writeSec) * time.Second,
		AuthToken:       authToken,

		Judge0URL:        strings.TrimRight(getEnv("JUDGE0_URL", "http://localhost:2358"), "/"),
		Judge0AuthHeader: getEnv("JUDGE0_AUTH_HEADER", "X-Auth-Token"),
		Judge0AuthToken:  getEnv("JUDGE0_AUTH_TOKEN", ""),
		Judge0Deadline:   lim.judge0Deadline,

		DefaultTimeout:   lim.defaultTimeout,
		MaxTimeout:       lim.maxTimeout,
		MemoryLimitKB:    lim.memoryLimitKB,
		MaxFileSizeKB:    lim.maxFileSizeKB,
		MaxCodeBytes:     lim.maxCodeBytes,
		MaxStdinBytes:    lim.maxStdinBytes,
		MaxOutputBytes:   lim.maxOutputBytes,
		MaxProcesses:     lim.maxProcesses,
		MaxConcurrent:    lim.maxConcurrent,
		QueueWaitTimeout: lim.queueWaitTimeout,
		ResultTimeout:    lim.resultTimeout,
		PollInitialDelay: lim.pollInitialDelay,
		PollInterval:     lim.pollInterval,

		LanguageIDs: languageIDs,
	}

	// Запрос остаётся открытым всё время ожидания результата: очередь Judge0 +
	// компиляция + выполнение. Если WriteTimeout меньше этого бюджета, сервер
	// разрывает соединение раньше, чем отдаст готовый результат, — поднимаем его.
	if minWrite := cfg.ResultTimeout + cfg.QueueWaitTimeout + 5*time.Second; cfg.WriteTimeout < minWrite {
		cfg.WriteTimeout = minWrite
	}

	return cfg, nil
}

// Address возвращает хост и порт в формате "host:port".
func (c *Config) Address() string {
	return fmt.Sprintf("%s:%s", c.Host, c.Port)
}

// limits содержит лимиты выполнения, вынесенные из Load для читаемости.
type limits struct {
	defaultTimeout   time.Duration
	maxTimeout       time.Duration
	memoryLimitKB    int
	maxFileSizeKB    int
	maxCodeBytes     int
	maxStdinBytes    int
	maxOutputBytes   int
	maxProcesses     int
	maxConcurrent    int
	queueWaitTimeout time.Duration
	resultTimeout    time.Duration
	pollInitialDelay time.Duration
	pollInterval     time.Duration
	judge0Deadline   time.Duration
}

func loadLimits() (*limits, error) {
	defaultTimeoutMs, err := getEnvInt("RUN_DEFAULT_TIMEOUT_MS", 3000)
	if err != nil {
		return nil, fmt.Errorf("invalid RUN_DEFAULT_TIMEOUT_MS: %w", err)
	}

	maxTimeoutMs, err := getEnvInt("RUN_MAX_TIMEOUT_MS", 5000)
	if err != nil {
		return nil, fmt.Errorf("invalid RUN_MAX_TIMEOUT_MS: %w", err)
	}

	if defaultTimeoutMs <= 0 || maxTimeoutMs <= 0 {
		return nil, fmt.Errorf("RUN_DEFAULT_TIMEOUT_MS and RUN_MAX_TIMEOUT_MS must be positive")
	}

	if defaultTimeoutMs > maxTimeoutMs {
		return nil, fmt.Errorf(
			"RUN_DEFAULT_TIMEOUT_MS (%d) must not exceed RUN_MAX_TIMEOUT_MS (%d)",
			defaultTimeoutMs, maxTimeoutMs,
		)
	}

	// Память: 256 МБ. На нижней границе диапазона из ТЗ (128 МБ) не стартуют JVM
	// и рантайм Go даже на тривиальных программах, поэтому берётся верхняя.
	memoryLimitKB, err := getEnvInt("RUN_MEMORY_LIMIT_KB", 262144)
	if err != nil {
		return nil, fmt.Errorf("invalid RUN_MEMORY_LIMIT_KB: %w", err)
	}

	// Лимит на размер файлов внутри песочницы. Ограничивает не вывод, а артефакты
	// сборки: бинарь Go занимает единицы мегабайт, поэтому 64 КБ здесь сломали бы
	// компиляцию. Обрезка stdout/stderr до 64 КБ выполняется адаптером.
	maxFileSizeKB, err := getEnvInt("RUN_MAX_FILE_SIZE_KB", 4096)
	if err != nil {
		return nil, fmt.Errorf("invalid RUN_MAX_FILE_SIZE_KB: %w", err)
	}

	maxCodeBytes, err := getEnvInt("RUN_MAX_CODE_BYTES", 64*1024)
	if err != nil {
		return nil, fmt.Errorf("invalid RUN_MAX_CODE_BYTES: %w", err)
	}

	maxStdinBytes, err := getEnvInt("RUN_MAX_STDIN_BYTES", 64*1024)
	if err != nil {
		return nil, fmt.Errorf("invalid RUN_MAX_STDIN_BYTES: %w", err)
	}

	maxOutputBytes, err := getEnvInt("RUN_MAX_OUTPUT_BYTES", 64*1024)
	if err != nil {
		return nil, fmt.Errorf("invalid RUN_MAX_OUTPUT_BYTES: %w", err)
	}

	if maxCodeBytes <= 0 || maxStdinBytes <= 0 || maxOutputBytes <= 0 {
		return nil, fmt.Errorf("RUN_MAX_CODE_BYTES, RUN_MAX_STDIN_BYTES and RUN_MAX_OUTPUT_BYTES must be positive")
	}

	maxProcesses, err := getEnvInt("RUN_MAX_PROCESSES", 64)
	if err != nil {
		return nil, fmt.Errorf("invalid RUN_MAX_PROCESSES: %w", err)
	}

	maxConcurrent, err := getEnvInt("RUN_MAX_CONCURRENT", 32)
	if err != nil {
		return nil, fmt.Errorf("invalid RUN_MAX_CONCURRENT: %w", err)
	}

	if maxConcurrent <= 0 {
		return nil, fmt.Errorf("RUN_MAX_CONCURRENT must be positive")
	}

	queueWaitMs, err := getEnvInt("RUN_QUEUE_WAIT_MS", 2000)
	if err != nil {
		return nil, fmt.Errorf("invalid RUN_QUEUE_WAIT_MS: %w", err)
	}

	resultTimeoutMs, err := getEnvInt("JUDGE0_RESULT_TIMEOUT_MS", 30000)
	if err != nil {
		return nil, fmt.Errorf("invalid JUDGE0_RESULT_TIMEOUT_MS: %w", err)
	}

	pollInitialDelayMs, err := getEnvInt("JUDGE0_POLL_INITIAL_DELAY_MS", 50)
	if err != nil {
		return nil, fmt.Errorf("invalid JUDGE0_POLL_INITIAL_DELAY_MS: %w", err)
	}

	pollIntervalMs, err := getEnvInt("JUDGE0_POLL_INTERVAL_MS", 100)
	if err != nil {
		return nil, fmt.Errorf("invalid JUDGE0_POLL_INTERVAL_MS: %w", err)
	}

	if pollIntervalMs <= 0 {
		return nil, fmt.Errorf("JUDGE0_POLL_INTERVAL_MS must be positive")
	}

	judge0TimeoutMs, err := getEnvInt("JUDGE0_REQUEST_TIMEOUT_MS", 10000)
	if err != nil {
		return nil, fmt.Errorf("invalid JUDGE0_REQUEST_TIMEOUT_MS: %w", err)
	}

	if memoryLimitKB <= 0 || maxFileSizeKB <= 0 || maxProcesses <= 0 {
		return nil, fmt.Errorf("RUN_MEMORY_LIMIT_KB, RUN_MAX_FILE_SIZE_KB and RUN_MAX_PROCESSES must be positive")
	}

	if queueWaitMs < 0 {
		return nil, fmt.Errorf("RUN_QUEUE_WAIT_MS must not be negative")
	}

	return &limits{
		defaultTimeout:   time.Duration(defaultTimeoutMs) * time.Millisecond,
		maxTimeout:       time.Duration(maxTimeoutMs) * time.Millisecond,
		memoryLimitKB:    memoryLimitKB,
		maxFileSizeKB:    maxFileSizeKB,
		maxCodeBytes:     maxCodeBytes,
		maxStdinBytes:    maxStdinBytes,
		maxOutputBytes:   maxOutputBytes,
		maxProcesses:     maxProcesses,
		maxConcurrent:    maxConcurrent,
		queueWaitTimeout: time.Duration(queueWaitMs) * time.Millisecond,
		resultTimeout:    time.Duration(resultTimeoutMs) * time.Millisecond,
		pollInitialDelay: time.Duration(pollInitialDelayMs) * time.Millisecond,
		pollInterval:     time.Duration(pollIntervalMs) * time.Millisecond,
		judge0Deadline:   time.Duration(judge0TimeoutMs) * time.Millisecond,
	}, nil
}

// loadLanguageIDs применяет переопределения JUDGE0_LANGUAGE_IDS поверх значений
// по умолчанию. Формат: "python=92,go=95". Пустое значение убирает язык из
// поддерживаемых (например, когда рантайм отсутствует в сборке Judge0).
func loadLanguageIDs() (map[string]int, error) {
	ids := DefaultLanguageIDs()

	raw := getEnv("JUDGE0_LANGUAGE_IDS", "")
	if raw == "" {
		return ids, nil
	}

	for _, pair := range strings.Split(raw, ",") {
		pair = strings.TrimSpace(pair)
		if pair == "" {
			continue
		}

		name, value, found := strings.Cut(pair, "=")
		name = strings.ToLower(strings.TrimSpace(name))
		value = strings.TrimSpace(value)

		if !found || name == "" {
			return nil, fmt.Errorf("invalid JUDGE0_LANGUAGE_IDS entry %q: expected language=id", pair)
		}

		if value == "" {
			delete(ids, name)
			continue
		}

		id, convErr := strconv.Atoi(value)
		if convErr != nil || id <= 0 {
			return nil, fmt.Errorf("invalid JUDGE0_LANGUAGE_IDS entry %q: id must be a positive integer", pair)
		}

		ids[name] = id
	}

	if len(ids) == 0 {
		return nil, fmt.Errorf("JUDGE0_LANGUAGE_IDS left no supported languages")
	}

	return ids, nil
}

// loadDotEnvs загружает корневой .env монорепозитория, а затем локальный apps/code-runner/.env
func loadDotEnvs() {
	// 1. Поиск корня репозитория (по pnpm-workspace.yaml / turbo.json / .git)
	if rootDir, err := findProjectRoot(); err == nil {
		rootEnvPath := filepath.Join(rootDir, ".env")
		if _, err := os.Stat(rootEnvPath); err == nil {
			_ = godotenv.Load(rootEnvPath)
		}
	}

	// 2. Локальный .env приложения (для локальных переопределений)
	_ = godotenv.Load(".env")
}

// findProjectRoot рекурсивно ищет корень монорепозитория вверх по файловому дереву.
func findProjectRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}

	for {
		if fileExists(filepath.Join(dir, "pnpm-workspace.yaml")) ||
			fileExists(filepath.Join(dir, "turbo.json")) ||
			fileExists(filepath.Join(dir, ".git")) {
			return dir, nil
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	return "", os.ErrNotExist
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func getEnv(key, fallback string) string {
	if val, exists := os.LookupEnv(key); exists && strings.TrimSpace(val) != "" {
		return strings.TrimSpace(val)
	}
	return fallback
}

func getEnvInt(key string, fallback int) (int, error) {
	valStr := os.Getenv(key)
	if strings.TrimSpace(valStr) == "" {
		return fallback, nil
	}
	return strconv.Atoi(strings.TrimSpace(valStr))
}
