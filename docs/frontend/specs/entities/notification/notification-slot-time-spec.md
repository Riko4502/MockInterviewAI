# Спецификация: рендер времени слота в уведомлениях (entities/notification)

## 1. Цель

В `NotificationItem.tsx` рендерить время слота из `payload` в таймзоне текущего пользователя (`userTimezone`), если событие содержит UTC-инстант слота.

## 2. Контекст

События `interview.match_proposed` и `interview.slot_booked` содержат UTC-инстанты слотов в `payload`. Отображать без учёта зоны читателя некорректно.

## 3. Требования

- Получить `userTimezone`: из профиля текущего пользователя `useCurrentUser()` → `user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"`
- Если в `payload` присутствует `slotStartsAt` (UTC) — отформатировать через `formatInstantInTimeZone(payload.slotStartsAt, userTimezone, 'd MMMM yyyy, HH:mm')` и отобразить в элементе уведомления
- При клике на уведомление использовать `actionUrl` и переходить в `/dashboard/partners/requests`
- Форматирование **только** через `@packages/utils/datetime`
- Не ломать существующий рендер других типов уведомлений

## 4. Файл правки

- `apps/web/src/entities/notification/ui/NotificationItem.tsx` (EDIT)

## 5. Тест-кейсы

- [ ] При наличии `payload.slotStartsAt` отображается отформатированное время в `userTimezone`
- [ ] При отсутствии поля — блок времени не отображается
- [ ] Клик ведёт по `actionUrl`
- [ ] Не влияет на другие типы уведомлений

## 6. Связи

- `@packages/utils/datetime` — `formatInstantInTimeZone`
- Профиль пользователя — `useCurrentUser()`
