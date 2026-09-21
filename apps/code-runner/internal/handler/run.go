// Package handler содержит HTTP-обработчики сервиса выполнения кода.
package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/mockinterviewai/code-runner/internal/runner"
)

// maxBodyOverhead — запас на JSON-обвязку поверх code и stdin: ключи, кавычки
// и экранирование (в худшем случае каждый байт кода занимает 6 символов \uXXXX).
const maxBodyOverhead = 4096

// ErrorResponse — тело ответа при ошибке.
type ErrorResponse struct {
	Error string `json:"error"`
}

// LanguagesResponse — список поддерживаемых языков.
type LanguagesResponse struct {
	Languages []string `json:"languages"`
}

// RunHandler обслуживает POST /api/v1/run.
type RunHandler struct {
	service     *runner.Service
	logger      *slog.Logger
	maxBodySize int64
}

// NewRunHandler создаёт обработчик запуска кода.
func NewRunHandler(service *runner.Service, logger *slog.Logger, maxCodeBytes, maxStdinBytes int) *RunHandler {
	return &RunHandler{
		service:     service,
		logger:      logger,
		maxBodySize: int64(maxCodeBytes*6+maxStdinBytes*6) + maxBodyOverhead,
	}
}

// Run выполняет пользовательский код и возвращает результат.
func (h *RunHandler) Run(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, h.maxBodySize)

	var req runner.Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			writeJSON(w, http.StatusRequestEntityTooLarge, ErrorResponse{Error: "request body is too large"})
			return
		}

		writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: "invalid json body"})

		return
	}

	result, err := h.service.Run(r.Context(), &req)
	if err != nil {
		h.writeRunError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
}

// Languages возвращает языки, которые сервис готов исполнять.
func (h *RunHandler) Languages(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, LanguagesResponse{Languages: h.service.Languages()})
}

// writeRunError переводит доменные ошибки в HTTP-коды.
func (h *RunHandler) writeRunError(w http.ResponseWriter, r *http.Request, err error) {
	var validationErr *runner.ValidationError

	switch {
	case errors.As(err, &validationErr):
		writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: validationErr.Message})

	case errors.Is(err, runner.ErrQueueFull):
		writeJSON(w, http.StatusTooManyRequests, ErrorResponse{Error: "execution queue is full, retry later"})

	case errors.Is(err, runner.ErrResultTimeout):
		writeJSON(w, http.StatusGatewayTimeout, ErrorResponse{Error: "timed out waiting for the execution result"})

	case errors.Is(err, r.Context().Err()) && r.Context().Err() != nil:
		// Клиент отключился: отвечать некому, соединение уже закрыто.
		return

	default:
		// Текст ошибки Judge0 наружу не отдаётся: он может содержать детали
		// инфраструктуры. В лог пишется полностью.
		h.logger.Error("code execution failed", slog.String("error", err.Error()))
		writeJSON(w, http.StatusBadGateway, ErrorResponse{Error: "code execution backend is unavailable"})
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
