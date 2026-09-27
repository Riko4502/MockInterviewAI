// Command server поднимает HTTP-сервис выполнения пользовательского кода
// поверх Judge0 CE.
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

	chi "github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/mockinterviewai/code-runner/internal/config"
	"github.com/mockinterviewai/code-runner/internal/handler"
	"github.com/mockinterviewai/code-runner/internal/judge0"
	"github.com/mockinterviewai/code-runner/internal/middleware"
	"github.com/mockinterviewai/code-runner/internal/runner"
)

func main() {
	if err := run(); err != nil {
		slog.Error("code-runner service failed", slog.String("error", err.Error()))
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	logger := newLogger(cfg)
	slog.SetDefault(logger)

	logger.Info(
		"starting code-runner service",
		slog.String("env", cfg.Environment),
		slog.String("address", cfg.Address()),
		slog.String("judge0", cfg.Judge0URL),
		slog.Int("maxConcurrent", cfg.MaxConcurrent),
	)

	judgeClient := judge0.New(judge0.Options{
		BaseURL:          cfg.Judge0URL,
		AuthHeader:       cfg.Judge0AuthHeader,
		AuthToken:        cfg.Judge0AuthToken,
		RequestTimeout:   cfg.Judge0Deadline,
		PollInitialDelay: cfg.PollInitialDelay,
		PollInterval:     cfg.PollInterval,
	})

	// Сверка language_id выполняется в фоне и только предупреждает: Judge0
	// может подниматься дольше сервиса, и падать из-за этого на старте нельзя.
	go verifyLanguages(cfg, judgeClient, logger)

	runService := runner.NewService(cfg, judgeClient, logger)

	runHandler := handler.NewRunHandler(runService, logger, cfg.MaxCodeBytes, cfg.MaxStdinBytes)
	healthHandler := handler.NewHealthHandler(judgeClient, cfg.Judge0Deadline)

	r := chi.NewRouter()

	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.Recoverer)
	r.Use(middleware.InternalAuth(cfg.AuthToken, "/healthz", "/readyz"))

	r.Get("/healthz", healthHandler.Healthz)
	r.Get("/readyz", healthHandler.Readyz)

	r.Route("/api/v1", func(api chi.Router) {
		api.Post("/run", runHandler.Run)
		api.Get("/languages", runHandler.Languages)
	})

	server := &http.Server{
		Addr:              cfg.Address(),
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       cfg.ReadTimeout,
		WriteTimeout:      cfg.WriteTimeout,
		IdleTimeout:       120 * time.Second,
	}

	serverErrCh := make(chan error, 1)

	go func() {
		logger.Info("server listening on", slog.String("address", cfg.Address()))

		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErrCh <- err
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	defer signal.Stop(quit)

	var serverErr error

	select {
	case err := <-serverErrCh:
		serverErr = err
		logger.Error("server fatal error", slog.String("error", err.Error()))

	case sig := <-quit:
		logger.Info("shutdown signal received", slog.String("signal", sig.String()))
	}

	logger.Info("initiating graceful shutdown...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("server forced to shutdown", slog.String("error", err.Error()))
	} else {
		logger.Info("http server gracefully stopped")
	}

	if serverErr != nil {
		return fmt.Errorf("server failed: %w", serverErr)
	}

	logger.Info("code-runner service exited cleanly")

	return nil
}

func newLogger(cfg *config.Config) *slog.Logger {
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

	return slog.New(logHandler)
}

// verifyLanguages сверяет настроенные language_id с реальным составом сборки
// Judge0. Несовпадение означает, что запрос уйдёт на чужой рантайм (или на
// несуществующий id), и это нужно увидеть в логе, а не в падающих запусках.
func verifyLanguages(cfg *config.Config, client *judge0.Client, logger *slog.Logger) {
	ctx, cancel := context.WithTimeout(context.Background(), cfg.Judge0Deadline)
	defer cancel()

	languages, err := client.Languages(ctx)
	if err != nil {
		logger.Warn(
			"failed to verify judge0 language ids on startup",
			slog.String("error", err.Error()),
		)

		return
	}

	available := make(map[int]string, len(languages))
	for _, language := range languages {
		available[language.ID] = language.Name
	}

	for name, id := range cfg.LanguageIDs {
		judgeName, ok := available[id]
		if !ok {
			logger.Warn(
				"configured judge0 language id is not available",
				slog.String("language", name),
				slog.Int("languageId", id),
			)

			continue
		}

		logger.Info(
			"judge0 language resolved",
			slog.String("language", name),
			slog.Int("languageId", id),
			slog.String("judge0Name", judgeName),
		)
	}
}
