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
	ShutdownTimeout time.Duration
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	AllowedOrigins         []string
	JWTSecret              string
	LogLevel               string
	AccessTokenCookieName  string
	MaxConnections         int
	MaxRoomClients         int

	// Redis конфигурация (из корневого .env)
	RedisAddr     string
	RedisPassword string
	RedisDB       int
	RedisEnabled  bool
}

// Load загружает настройки из переменных окружения и .env файлов.
// JWT_SECRET и Redis параметры читаются напрямую из корневого .env файла монорепозитория.
func Load() (*Config, error) {
	loadDotEnvs()

	port := getEnv("REALTIME_PORT", getEnv("PORT", "8080"))
	host := getEnv("REALTIME_HOST", getEnv("HOST", "0.0.0.0"))
	env := getEnv("ENV", "development")
	jwtSecret := getEnv("JWT_SECRET", "")

	if jwtSecret == "" {
		if env == "production" {
			return nil, fmt.Errorf("JWT_SECRET is required in production (must be set in root .env or environment)")
		}
		jwtSecret = "mock-interview-default-secret-key-change-in-prod"
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

	return &Config{
		Port:                  port,
		Host:                  host,
		Environment:           env,
		ShutdownTimeout:       time.Duration(shutdownSec) * time.Second,
		ReadTimeout:           time.Duration(readSec) * time.Second,
		WriteTimeout:          time.Duration(writeSec) * time.Second,
		AllowedOrigins:        allowedOrigins,
		JWTSecret:             jwtSecret,
		LogLevel:              getEnv("LOG_LEVEL", "debug"),
		AccessTokenCookieName: getEnv("ACCESS_TOKEN_COOKIE_NAME", "access_token"),
		MaxConnections:        maxConn,
		MaxRoomClients:        maxRoomClients,
		RedisAddr:             redisAddr,
		RedisPassword:         redisPassword,
		RedisDB:               redisDB,
		RedisEnabled:          redisEnabled,
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

func getEnvInt(key string, fallback int) (int, error) {
	valStr := os.Getenv(key)
	if valStr == "" {
		return fallback, nil
	}
	return strconv.Atoi(strings.TrimSpace(valStr))
}
