package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/mockinterviewai/realtime/internal/auth"
	"github.com/mockinterviewai/realtime/internal/config"
	"github.com/mockinterviewai/realtime/internal/handler"
	"github.com/mockinterviewai/realtime/internal/middleware"
	"github.com/mockinterviewai/realtime/internal/storage"
	"github.com/mockinterviewai/realtime/internal/ws"
)

func main() {
	// 1. Инициализация конфигурации
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load configuration: %v\n", err)
		os.Exit(1)
	}

	// 2. Инициализация структурированного логгера slog
	var level slog.Level
	switch strings.ToLower(cfg.LogLevel) {
	case "info":
		level = slog.LevelInfo
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	default:
		level = slog.LevelDebug
	}

	var logHandler slog.Handler
	if cfg.Environment == "production" {
		logHandler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})
	} else {
		logHandler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: level})
	}
	logger := slog.New(logHandler)
	slog.SetDefault(logger)

	logger.Info("starting realtime service",
		slog.String("env", cfg.Environment),
		slog.String("logLevel", cfg.LogLevel),
		slog.String("port", cfg.Port),
		slog.Duration("shutdownTimeout", cfg.ShutdownTimeout),
		slog.Bool("redisEnabled", cfg.RedisEnabled),
	)

	// 3. Инициализация контекста, хранилища Redis, токен-верификатора и ядра WebSocket
	rootCtx, rootCancel := context.WithCancel(context.Background())
	defer rootCancel()

	redisStore := storage.NewRedisStore(cfg, logger)
	tokenVerifier := auth.NewTokenVerifier(cfg.JWTAccessSecret)
	hub := ws.NewHub(rootCtx, redisStore, redisStore, logger)

	healthHandler := handler.NewHealthHandler(hub, redisStore)
	wsHandler := handler.NewWebSocketHandler(hub, tokenVerifier, redisStore, logger, cfg.AllowedOrigins, cfg.AccessTokenCookieName, cfg.MaxConnections, cfg.MaxRoomClients)

	// 4. Настройка HTTP-роутера chi
	r := chi.NewRouter()

	// Базовые middleware
	r.Use(chimiddleware.RequestID)
	r.Use(middleware.Recoverer(logger))
	r.Use(middleware.RequestLogger(logger))
	r.Use(middleware.CORS(cfg.AllowedOrigins))

	// Регистрация маршрутов
	r.Get("/healthz", healthHandler.Healthz)
	r.Get("/readyz", healthHandler.Readyz)
	r.Get("/ws/sessions/{sessionId}", wsHandler.HandleSessionWS)

	// 5. Конфигурация HTTP-сервера
	server := &http.Server{
		Addr:              cfg.Address(),
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       cfg.ReadTimeout,
		WriteTimeout:      cfg.WriteTimeout,
		IdleTimeout:       120 * time.Second,
	}

	// 6. Запуск сервера в отдельной горутине
	serverErrCh := make(chan error, 1)
	go func() {
		logger.Info("server listening on", slog.String("address", cfg.Address()))
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErrCh <- err
		}
	}()

	// 7. Ожидание сигналов завершения ОС (SIGINT, SIGTERM)
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-serverErrCh:
		logger.Error("server fatal error", slog.String("error", err.Error()))
		os.Exit(1)
	case sig := <-quit:
		logger.Info("shutdown signal received", slog.String("signal", sig.String()))
	}

	// 8. Graceful Shutdown
	logger.Info("initiating graceful shutdown...")

	// Шаг 1: Закрываем все сокеты и комнаты (клиенты получают CloseNormalClosure)
	if err := hub.Close(); err != nil {
		logger.Warn("error closing hub", slog.String("error", err.Error()))
	}

	// Шаг 2: Закрываем соединение с Redis
	if err := redisStore.Close(); err != nil {
		logger.Warn("error closing redis client", slog.String("error", err.Error()))
	}

	// Шаг 3: Закрываем HTTP-сервер с таймаутом
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("server forced to shutdown", slog.String("error", err.Error()))
	} else {
		logger.Info("http server gracefully stopped")
	}

	logger.Info("realtime service exited cleanly")
}
