package sse

// Контракты payload'ов соответствуют справочнику типов фронтенда
// (docs/frontend/data/realtime.md, раздел 4) и таблице событий SSE_SPEC.md (раздел 4.2).
// Сервис realtime не декодирует payload при доставке (он передается как
// json.RawMessage), поэтому эти структуры используются продюсерами на Go,
// тестами и как единая точка правды по формату событий.

// NotificationNewPayload описывает новое персональное уведомление пользователя.
type NotificationNewPayload struct {
	ID        string               `json:"id"`
	Category  NotificationCategory `json:"category"`
	Title     string               `json:"title"`
	Message   string               `json:"message"`
	ActionURL string               `json:"actionUrl,omitempty"`
	CreatedAt string               `json:"createdAt"`
	Read      bool                 `json:"read"`
}

// NotificationBadgePayload описывает обновление счетчика непрочитанных уведомлений.
type NotificationBadgePayload struct {
	UnreadCount int `json:"unreadCount"`
}

// SessionInvitedPayload описывает приглашение пользователя в комнату собеседования.
type SessionInvitedPayload struct {
	SessionID    string `json:"sessionId"`
	SessionTitle string `json:"sessionTitle"`
	InviterName  string `json:"inviterName"`
	Role         string `json:"role"`
	JoinURL      string `json:"joinUrl"`
	ExpiresAt    string `json:"expiresAt"`
}

// CodeRunnerStatusPayload описывает результат асинхронного прогона автотестов кандидата.
type CodeRunnerStatusPayload struct {
	TaskID          string `json:"taskId"`
	SessionID       string `json:"sessionId"`
	Status          string `json:"status"`
	PassedCount     int    `json:"passedCount"`
	TotalCount      int    `json:"totalCount"`
	ExecutionTimeMs int64  `json:"executionTimeMs"`
}

// AIReportReadyPayload описывает готовность итогового AI-отчета по интервью.
type AIReportReadyPayload struct {
	SessionID string `json:"sessionId"`
	ReportID  string `json:"reportId"`
	Score     int    `json:"score"`
	Summary   string `json:"summary"`
	ReportURL string `json:"reportUrl"`
}

// AccountUpdatedPayload описывает изменение баланса кредитов или тарифного плана.
type AccountUpdatedPayload struct {
	RemainingCredits int    `json:"remainingCredits"`
	Plan             string `json:"plan"`
	Reason           string `json:"reason,omitempty"`
}

// MaintenanceWindow описывает окно проведения технических работ.
type MaintenanceWindow struct {
	StartsAt string `json:"startsAt"`
	EndsAt   string `json:"endsAt"`
}

// SystemBroadcastPayload описывает общесистемный алерт для всех подключенных пользователей.
type SystemBroadcastPayload struct {
	Severity          string             `json:"severity"`
	Message           string             `json:"message"`
	MaintenanceWindow *MaintenanceWindow `json:"maintenanceWindow,omitempty"`
}

// AuthRevokedPayload описывает причину принудительного разрыва SSE-потока.
type AuthRevokedPayload struct {
	Reason string `json:"reason"`
}
