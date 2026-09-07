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
	Port                   string
	Host                   string
	Environment            string
	ShutdownTimeout        time.Duration
	ReadTimeout            time.Duration
	WriteTimeout           time.Duration
	AllowedOrigins         []string
	JWTAccessSecret        string
	JWTRefreshSecret       string
	LogLevel               string
	AccessTokenCookieName  string
	RefreshTokenCookieName string
	MaxConnections         int
	MaxRoomClients         int

	// MetricsAllowPublic снимает ограничение на источник запросов к /metrics.
	// По умолчанию эндпоинт отвечает только петлевым и частным адресам, так как
	// раскрывает число активных пользователей ноды.
	MetricsAllowPublic bool

	// TrustProxyHeaders разрешает определять IP клиента по заголовкам
	// X-Forwarded-For / X-Real-IP. Включается только когда сервис действительно
	// стоит за доверенным обратным прокси: иначе клиент подделает заголовок
	// и обойдет лимит соединений на один IP.
	TrustProxyHeaders bool

	// SSE конфигурация (глобальный поток уведомлений /sse/notifications)
	SSEHeartbeatInterval     time.Duration
	SSEStreamBlockInterval   time.Duration
	SSESlowConsumerGrace     time.Duration
	SSEClientBufferSize      int
	SSEMaxConnectionsPerUser int
	SSEMaxConnectionsPerIP   int
	SSEReplayCount           int
	SSERetryMs               int

	// Redis конфигурация (из корневого .env)
	RedisAddr     string
	RedisPassword string
	RedisDB       int
	RedisPoolSize int
	RedisEnabled  bool

	// AllowAccessFallback разрешает подключение старых клиентов по access-токену
	// (typ=="access", multi-use). Выключается после перевода всех клиентов на тикеты (P9).
	AllowAccessFallback bool
}

// Load загружает настройки из переменных окружения и .env файлов.
// JWT_ACCESS_SECRET и Redis параметры читаются напрямую из корневого .env файла монорепозитория.
func Load() (*Config, error) {
	loadDotEnvs()

	port := getEnv("REALTIME_PORT", getEnv("PORT", "8080"))
	host := getEnv("REALTIME_HOST", getEnv("HOST", "0.0.0.0"))
	env := getEnv("ENV", "development")

	// Считываем JWT ключи: 우선 JWT_ACCESS_SECRET, для обратной совместимости fallback на JWT_SECRET
	jwtAccessSecret := getEnv("JWT_ACCESS_SECRET", getEnv("JWT_SECRET", ""))
	jwtRefreshSecret := getEnv("JWT_REFRESH_SECRET", "")

	if jwtAccessSecret == "" {
		if env == "production" {
			return nil, fmt.Errorf("JWT_ACCESS_SECRET (or JWT_SECRET) is required in production (must be set in root .env or environment)")
		}
		jwtAccessSecret = "mock-interview-default-access-secret-key-change-in-prod"
	}

	shutdownSec, err := getEnvInt("SHUTDOWN_TIMEOUT_SECONDS", 10)
	if err != nil {
		return nil, fmt.Errorf("invalid SHUTDOWN_TIMEOUT_SECONDS: %w", err)
	}

	readSec, err := getEnvInt("READ_TIMEOUT_SECONDS", 15)
	if err != nil {
		return nil, fmt.Errorf("invalid READ_TIMEOUT_SECONDS: %w", err)
	}

	writeSec, err := getEnvInt("WRITE_TIMEOUT_SECONDS", 15)
	if err != nil {
		return nil, fmt.Errorf("invalid WRITE_TIMEOUT_SECONDS: %w", err)
	}

	rawOrigins := getEnv("ALLOWED_ORIGINS", "")
	if rawOrigins == "" {
		if env == "production" {
			return nil, fmt.Errorf("ALLOWED_ORIGINS is required in production to prevent Cross-Site WebSocket Hijacking (CSWSH)")
		}
		rawOrigins = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,*"
	}

	var allowedOrigins []string
	for _, origin := range strings.Split(rawOrigins, ",") {
		trimmed := strings.TrimSpace(origin)
		if trimmed != "" {
			if env == "production" && trimmed == "*" {
				return nil, fmt.Errorf("wildcard '*' in ALLOWED_ORIGINS is forbidden in production (vulnerable to CSWSH when using cookie authentication)")
			}
			allowedOrigins = append(allowedOrigins, trimmed)
		}
	}

	// Настройка Redis
	redisHost := getEnv("REDIS_HOST", "localhost")
	redisPort := getEnv("REDIS_PORT", "6379")
	redisPassword := getEnv("REDIS_PASSWORD", "")
	redisDB, _ := getEnvInt("REDIS_DB", 0)

	redisURL := getEnv("REDIS_URL", "")
	redisAddr := fmt.Sprintf("%s:%s", redisHost, redisPort)
	if redisURL != "" {
		redisAddr = redisURL
	}

	redisEnabledStr := getEnv("REDIS_ENABLED", "")
	redisEnabled := redisEnabledStr == "true" || redisEnabledStr == "1" || (redisEnabledStr == "" && env == "production")

	maxConn, err := getEnvInt("MAX_CONNECTIONS", 10000)
	if err != nil {
		return nil, fmt.Errorf("invalid MAX_CONNECTIONS: %w", err)
	}

	maxRoomClients, err := getEnvInt("MAX_ROOM_CLIENTS", 20)
	if err != nil {
		return nil, fmt.Errorf("invalid MAX_ROOM_CLIENTS: %w", err)
	}

	allowAccessFallback := true
	if s := strings.TrimSpace(getEnv("REALTIME_ALLOW_ACCESS_FALLBACK", "true")); s != "" {
		parsed, parseErr := strconv.ParseBool(s)
		if parseErr == nil {
			allowAccessFallback = parsed
		}
	}

	// Блокирующий XREAD удерживает соединение из пула на каждого пользователя
	// с открытым SSE-потоком, поэтому пул задается явно и с запасом.
	redisPoolSize, err := getEnvInt("REDIS_POOL_SIZE", 100)
	if err != nil {
		return nil, fmt.Errorf("invalid REDIS_POOL_SIZE: %w", err)
	}

	sseCfg, err := loadSSEConfig()
	if err != nil {
		return nil, err
	}

	return &Config{
		Port:                   port,
		Host:                   host,
		Environment:            env,
		ShutdownTimeout:        time.Duration(shutdownSec) * time.Second,
		ReadTimeout:            time.Duration(readSec) * time.Second,
		WriteTimeout:           time.Duration(writeSec) * time.Second,
		AllowedOrigins:         allowedOrigins,
		JWTAccessSecret:        jwtAccessSecret,
		JWTRefreshSecret:       jwtRefreshSecret,
		LogLevel:               getEnv("LOG_LEVEL", "debug"),
		AccessTokenCookieName:  getEnv("JWT_ACCESS_COOKIE_NAME", getEnv("ACCESS_TOKEN_COOKIE_NAME", "access_token")),
		RefreshTokenCookieName: getEnv("JWT_REFRESH_COOKIE_NAME", getEnv("REFRESH_TOKEN_COOKIE_NAME", "refresh_token")),
		MaxConnections:         maxConn,
		MaxRoomClients:         maxRoomClients,
		TrustProxyHeaders:      getEnvBool("TRUST_PROXY_HEADERS", false),
		MetricsAllowPublic:     getEnvBool("METRICS_ALLOW_PUBLIC", false),

		SSEHeartbeatInterval:     sseCfg.HeartbeatInterval,
		SSEStreamBlockInterval:   sseCfg.StreamBlockInterval,
		SSESlowConsumerGrace:     sseCfg.SlowConsumerGrace,
		SSEClientBufferSize:      sseCfg.ClientBufferSize,
		SSEMaxConnectionsPerUser: sseCfg.MaxConnectionsPerUser,
		SSEMaxConnectionsPerIP:   sseCfg.MaxConnectionsPerIP,
		SSEReplayCount:           sseCfg.ReplayCount,
		SSERetryMs:               sseCfg.RetryMs,

		RedisAddr:           redisAddr,
		RedisPassword:       redisPassword,
		RedisDB:             redisDB,
		RedisPoolSize:       redisPoolSize,
		RedisEnabled:        redisEnabled,
		AllowAccessFallback: allowAccessFallback,
	}, nil
}

// sseSettings содержит параметры подсистемы Server-Sent Events.
type sseSettings struct {
	HeartbeatInterval     time.Duration
	StreamBlockInterval   time.Duration
	SlowConsumerGrace     time.Duration
	ClientBufferSize      int
	MaxConnectionsPerUser int
	MaxConnectionsPerIP   int
	ReplayCount           int
	RetryMs               int
}

// loadSSEConfig читает настройки потока уведомлений /sse/notifications.
// Значения по умолчанию соответствуют SSE_SPEC.md (heartbeat 15 сек,
// retry 3000 мс, буфер 128 событий, 5 соединений на пользователя, 20 на IP).
func loadSSEConfig() (*sseSettings, error) {
	heartbeatSec, err := getEnvInt("SSE_HEARTBEAT_SECONDS", 15)
	if err != nil {
		return nil, fmt.Errorf("invalid SSE_HEARTBEAT_SECONDS: %w", err)
	}

	blockSec, err := getEnvInt("SSE_STREAM_BLOCK_SECONDS", 15)
	if err != nil {
		return nil, fmt.Errorf("invalid SSE_STREAM_BLOCK_SECONDS: %w", err)
	}

	graceSec, err := getEnvInt("SSE_SLOW_CONSUMER_GRACE_SECONDS", 30)
	if err != nil {
		return nil, fmt.Errorf("invalid SSE_SLOW_CONSUMER_GRACE_SECONDS: %w", err)
	}

	bufferSize, err := getEnvInt("SSE_CLIENT_BUFFER_SIZE", 128)
	if err != nil {
		return nil, fmt.Errorf("invalid SSE_CLIENT_BUFFER_SIZE: %w", err)
	}

	maxPerUser, err := getEnvInt("SSE_MAX_CONNECTIONS_PER_USER", 5)
	if err != nil {
		return nil, fmt.Errorf("invalid SSE_MAX_CONNECTIONS_PER_USER: %w", err)
	}

	maxPerIP, err := getEnvInt("SSE_MAX_CONNECTIONS_PER_IP", 20)
	if err != nil {
		return nil, fmt.Errorf("invalid SSE_MAX_CONNECTIONS_PER_IP: %w", err)
	}

	replayCount, err := getEnvInt("SSE_REPLAY_COUNT", 20)
	if err != nil {
		return nil, fmt.Errorf("invalid SSE_REPLAY_COUNT: %w", err)
	}

	retryMs, err := getEnvInt("SSE_RETRY_MS", 3000)
	if err != nil {
		return nil, fmt.Errorf("invalid SSE_RETRY_MS: %w", err)
	}

	return &sseSettings{
		HeartbeatInterval:     time.Duration(heartbeatSec) * time.Second,
		StreamBlockInterval:   time.Duration(blockSec) * time.Second,
		SlowConsumerGrace:     time.Duration(graceSec) * time.Second,
		ClientBufferSize:      bufferSize,
		MaxConnectionsPerUser: maxPerUser,
		MaxConnectionsPerIP:   maxPerIP,
		ReplayCount:           replayCount,
		RetryMs:               retryMs,
	}, nil
}

// Address возвращает хост и порт в формате "host:port".
func (c *Config) Address() string {
	return fmt.Sprintf("%s:%s", c.Host, c.Port)
}

// loadDotEnvs загружает корневой .env монорепозитория, а затем локальный apps/realtime/.env
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

// getEnvBool читает булеву переменную окружения ("true"/"1"/"yes" — истина).
func getEnvBool(key string, fallback bool) bool {
	raw := strings.ToLower(getEnv(key, ""))
	if raw == "" {
		return fallback
	}

	return raw == "true" || raw == "1" || raw == "yes"
}

func getEnvInt(key string, fallback int) (int, error) {
	valStr := os.Getenv(key)
	if valStr == "" {
		return fallback, nil
	}
	return strconv.Atoi(strings.TrimSpace(valStr))
}
