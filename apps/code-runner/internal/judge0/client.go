package judge0

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// maxResponseBytes ограничивает тело ответа Judge0. Вывод программы уже
// обрезан самим Judge0 по max_file_size, но лимит на стороне клиента страхует
// от неконтролируемого роста потребления памяти сервисом.
const maxResponseBytes = 8 << 20 // 8 МБ

// resultFields перечисляет поля, которые сервис читает из submission.
// Judge0 по умолчанию отдаёт ~30 полей, большая часть которых не нужна.
const resultFields = "token,stdout,stderr,compile_output,message,exit_code,exit_signal,time,memory,status"

// Client — HTTP-клиент Judge0 CE.
type Client struct {
	baseURL    string
	authHeader string
	authToken  string
	httpClient *http.Client

	pollInitialDelay time.Duration
	pollInterval     time.Duration
}

// Options описывает параметры конструктора New.
type Options struct {
	// BaseURL — корень API Judge0, без завершающего слеша.
	BaseURL string

	// AuthHeader/AuthToken — заголовок авторизации Judge0 (по умолчанию
	// X-Auth-Token). При пустом AuthToken заголовок не отправляется.
	AuthHeader string
	AuthToken  string

	// RequestTimeout ограничивает один HTTP-запрос, а не всё ожидание результата.
	RequestTimeout time.Duration

	// PollInitialDelay — пауза перед первым опросом: даже тривиальная программа
	// не успевает выполниться мгновенно, и немедленный GET всегда вернул бы
	// "In Queue".
	PollInitialDelay time.Duration
	PollInterval     time.Duration
}

// New создаёт клиента Judge0.
func New(opts Options) *Client {
	if opts.AuthHeader == "" {
		opts.AuthHeader = "X-Auth-Token"
	}

	if opts.RequestTimeout <= 0 {
		opts.RequestTimeout = 10 * time.Second
	}

	if opts.PollInterval <= 0 {
		opts.PollInterval = 100 * time.Millisecond
	}

	return &Client{
		baseURL:    strings.TrimRight(opts.BaseURL, "/"),
		authHeader: opts.AuthHeader,
		authToken:  opts.AuthToken,
		httpClient: &http.Client{
			Timeout: opts.RequestTimeout,
		},
		pollInitialDelay: opts.PollInitialDelay,
		pollInterval:     opts.PollInterval,
	}
}

// Execute создаёт submission и опрашивает Judge0 до финального статуса.
//
// Общий бюджет ожидания задаётся сроком ctx: Judge0 выполняет код асинхронно,
// и единственный способ ограничить полное время ответа — дедлайн на стороне
// вызывающего. Синхронный режим Judge0 (wait=true) не используется намеренно:
// он держит воркер Rails занятым всё время выполнения и официально не
// рекомендован в production.
func (c *Client) Execute(ctx context.Context, sub *Submission) (*Result, error) {
	token, err := c.Create(ctx, sub)
	if err != nil {
		return nil, err
	}

	timer := time.NewTimer(c.pollInitialDelay)
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-timer.C:
		}

		result, err := c.Get(ctx, token)
		if err != nil {
			return nil, err
		}

		if result.IsFinal() {
			return result, nil
		}

		timer.Reset(c.pollInterval)
	}
}

// Create отправляет submission в очередь Judge0 и возвращает её токен.
func (c *Client) Create(ctx context.Context, sub *Submission) (string, error) {
	payload := *sub
	payload.SourceCode = base64.StdEncoding.EncodeToString([]byte(sub.SourceCode))

	if sub.Stdin != "" {
		payload.Stdin = base64.StdEncoding.EncodeToString([]byte(sub.Stdin))
	}

	body, err := json.Marshal(&payload)
	if err != nil {
		return "", fmt.Errorf("failed to encode judge0 submission: %w", err)
	}

	req, err := c.newRequest(ctx, http.MethodPost, "/submissions?base64_encoded=true&wait=false", bytes.NewReader(body))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")

	var created struct {
		Token string `json:"token"`
	}

	if err := c.do(req, &created); err != nil {
		return "", err
	}

	if created.Token == "" {
		return "", fmt.Errorf("judge0 returned an empty submission token")
	}

	return created.Token, nil
}

// Get возвращает текущее состояние submission с декодированными из base64 полями.
func (c *Client) Get(ctx context.Context, token string) (*Result, error) {
	path := fmt.Sprintf(
		"/submissions/%s?base64_encoded=true&fields=%s",
		url.PathEscape(token),
		url.QueryEscape(resultFields),
	)

	req, err := c.newRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}

	var result Result
	if err := c.do(req, &result); err != nil {
		return nil, err
	}

	decodeField(&result.Stdout)
	decodeField(&result.Stderr)
	decodeField(&result.CompileOutput)
	decodeField(&result.Message)

	return &result, nil
}

// Languages возвращает языки, доступные в текущей сборке Judge0.
// Используется на старте сервиса для сверки JUDGE0_LANGUAGE_IDS.
func (c *Client) Languages(ctx context.Context) ([]Language, error) {
	req, err := c.newRequest(ctx, http.MethodGet, "/languages", nil)
	if err != nil {
		return nil, err
	}

	var languages []Language
	if err := c.do(req, &languages); err != nil {
		return nil, err
	}

	return languages, nil
}

// Ping проверяет доступность Judge0 (readiness-проба сервиса).
func (c *Client) Ping(ctx context.Context) error {
	req, err := c.newRequest(ctx, http.MethodGet, "/about", nil)
	if err != nil {
		return err
	}

	return c.do(req, nil)
}

func (c *Client) newRequest(ctx context.Context, method, path string, body io.Reader) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return nil, fmt.Errorf("failed to build judge0 request: %w", err)
	}

	if c.authToken != "" {
		req.Header.Set(c.authHeader, c.authToken)
	}

	req.Header.Set("Accept", "application/json")

	return req, nil
}

// do выполняет запрос и декодирует успешный ответ в out (nil — тело игнорируется).
func (c *Client) do(req *http.Request, out any) error {
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("judge0 request failed: %w", err)
	}

	defer func() {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, maxResponseBytes))
		_ = resp.Body.Close()
	}()

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
	if err != nil {
		return fmt.Errorf("failed to read judge0 response: %w", err)
	}

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return &APIError{StatusCode: resp.StatusCode, Body: strings.TrimSpace(string(body))}
	}

	if out == nil {
		return nil
	}

	if err := json.Unmarshal(body, out); err != nil {
		return fmt.Errorf("failed to decode judge0 response: %w", err)
	}

	return nil
}

// decodeField расшифровывает base64-поле ответа на месте. Judge0 иногда
// возвращает значения с переводами строк внутри base64, поэтому они вырезаются
// перед декодированием; нерасшифруемое значение оставляется как есть, чтобы не
// потерять диагностику.
func decodeField(field **string) {
	if *field == nil {
		return
	}

	raw := strings.NewReplacer("\n", "", "\r", "").Replace(**field)
	if raw == "" {
		*field = nil
		return
	}

	decoded, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return
	}

	value := string(decoded)
	*field = &value
}
