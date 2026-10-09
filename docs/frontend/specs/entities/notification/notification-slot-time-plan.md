# План реализации: рендер времени слота в уведомлениях

## 1. `NotificationItem.tsx` (EDIT)
Путь: `apps/web/src/entities/notification/ui/NotificationItem.tsx`

- [ ] Импорт `useCurrentUser`
- [ ] Импорт `formatInstantInTimeZone` из `@packages/utils/datetime`
- [ ] Вычислить `userTimezone`
- [ ] Проверить наличие `payload.slotStartsAt` (и тип события при необходимости)
- [ ] Если есть — отформатировать `'d MMMM yyyy, HH:mm'` и отобразить в UI
- [ ] Клик по уведомлению использует `actionUrl` → `/dashboard/partners/requests`

## 2. Тесты
- [ ] Тест на отображение времени при наличии `slotStartsAt`
- [ ] Тест на отсутствие блока при отсутствии поля

## 3. Проверки
- [ ] tsc без ошибок
- [ ] Сохранена логика других типов уведомлений
