# Спецификация: рендер времени слота в уведомлениях (entities/notification)

## Статус: закрыто без изменений фронта (2026-10-16)

План **не реализуется**: функциональность уже закрыта бэкендом, а исходная
спецификация опиралась на неверные факты о payload.

### Что оказалось на самом деле

1. **Ключей `payload.slotStartsAt` не существует.** Событие
   `interview.match_proposed` несёт `payload.proposedStartUtc`, событие
   `interview.slot_booked` — `payload.startUtc`
   (`apps/api/src/modules/matchmaking/matchmaking.service.ts:657-697`).
2. **Время уже рендерится в таймзоне читателя.** `renderNotification`
   (`packages/i18n/src/render-notification.ts`) подставляет UTC-инстант в
   `message` через `Intl.DateTimeFormat` с `timeZone` получателя, а
   `NotificationsService` лениво перерисовывает текст при смене
   `renderedTimezone`/`renderedLocale` (`apps/api/src/modules/notifications/notifications.service.ts:315-356, 533-577`).
   То есть `NotificationItem` уже показывает время в зоне пользователя —
   в составе `message`.
3. **Action URL.** Клик по уведомлению идёт по `notification.actionUrl`
   (`NotificationActions.tsx`). Бэкенд проставляет `/matchmaking/requests/:id`
   и `/interviews/:id`, а не `/dashboard/partners/requests`, как утверждала
   старая версия этого документа.

### Почему рендер на фронте не добавляется

Отдельный блок времени в `NotificationItem` дублировал бы время, уже
входящее в `message`, что ухудшает UI без выигрыша в корректности. Правило
§3.2 `datetime-and-i18n-rules-spec.md` (перечисляющее `NotificationItem` в
потребителях `viewerTimezone`) устарело: форматирование выполняется на
сервере.

### Что осталось как исторический план

См. `notification-slot-time-plan.md` — оставлен для трассируемости, пункты
не выполняются.

## 6. Связи

- `@packages/i18n` — `renderNotification` (серверный рендер времени)
- `apps/api/.../notifications.service.ts` — ленивый пересчёт `renderedTimezone`
