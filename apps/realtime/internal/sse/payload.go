package sse

// Контракты payload'ов описаны Zod-схемами в источнике правды
// packages/dto/src/realtime/sse-event.dto.ts (ADR-004:86) и продублированы
// здесь как точка правды для Go-продюсеров и тестов. Сервис realtime не
// декодирует payload при доставке — тот передаётся как json.RawMessage.

// NotificationNewPayload описывает новое персональное уведомление пользователя.
//
// Поле Category — доменный NotificationType из БД (SYSTEM | INTERVIEW |
// MESSAGE), а не визуальная severity. До переименования здесь стоял тип
// NotificationCategory со значениями info | success | warning | error, то есть
// объявление поля противоречило тому, что реально приходит по проводу, и
// расхождение было молчаливым: payload не декодируется (ADR-004:87).
// Перечисление NotificationType намеренно не продублировано в Go: это
// доменное перечисление БД, и вторая его копия в этом сервисе разошлась бы с
// Prisma-схемой так же, как разошёлся NotificationCategory.
//
// Severity необязательна: её пока не заполняет ни один продюсер.
type NotificationNewPayload struct {
	ID        string   `json:"id"`
	Category  string   `json:"category"`
	Severity  Severity `json:"severity,omitempty"`
	Title     string   `json:"title"`
	Message   string   `json:"message"`
	ActionURL string   `json:"actionUrl,omitempty"`
	CreatedAt string   `json:"createdAt"`
	Read      bool     `json:"read"`
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
//
// Severity здесь — единственное место, где визуальная severity приходит от
// продюсера: уведомления колокольчика её не несут.
type SystemBroadcastPayload struct {
	Severity          Severity           `json:"severity"`
	Message           string             `json:"message"`
	MaintenanceWindow *MaintenanceWindow `json:"maintenanceWindow,omitempty"`
}

// AuthRevokedPayload описывает причину принудительного разрыва SSE-потока.
type AuthRevokedPayload struct {
	Reason string `json:"reason"`
}
