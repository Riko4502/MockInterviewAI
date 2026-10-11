# План реализации: рендер времени слота в уведомлениях

## 1. `NotificationItem.tsx` (EDIT)
Путь: `apps/web/src/entities/notification/ui/NotificationItem.tsx`

- [ ] Импорт `useCurrentUser`
- [ ] Импорт `formatInstantInTimeZone` из `@packages/utils` (корневой баррeль; подпуть `@packages/utils/datetime` в репозитории отсутствует)
- [ ] Вычислить `userTimezone` из `useViewerTimezone()` (см. [1]; требует backend-предпосылки [B], §2.1 спецификации правил)
- [ ] Проверить наличие `payload.slotStartsAt` (и тип события при необходимости)
- [ ] Если есть — отформатировать `'d MMMM yyyy, HH:mm'` и отобразить в UI
- [ ] Клик по уведомлению использует `actionUrl` → `/dashboard/partners/requests`

## 2. Тесты
- [ ] Тест на отображение времени при наличии `slotStartsAt`
- [ ] Тест на отсутствие блока при отсутствии поля

## 3. Проверки
- [ ] tsc без ошибок
- [ ] Сохранена логика других типов уведомлений
