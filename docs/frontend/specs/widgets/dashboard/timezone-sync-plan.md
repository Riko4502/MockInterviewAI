# План реализации: синхронизация таймзоны в дашборде

## 1. `DashboardUpcomingSession.tsx` (EDIT)
- [ ] Импорт `useCurrentUser`
- [ ] Вычислить `userTimezone`: `const { data: user } = useCurrentUser()` → `user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"` (требует backend-предпосылки [B], §2.1 спецификации правил)
- [ ] Заменить использование `useState("UTC")` и все места, где использовался локальный стейт
- [ ] Применить `userTimezone` к форматированиям

## 2. `DashboardRecentSessions.tsx` (EDIT)
- [ ] Аналогично п.1

## 3. Тесты
- [ ] Проверка использования профильной таймзоны

## 4. Проверки
- [ ] tsc без ошибок
- [ ] Нет прямых импортов дат при изменениях форматирования
