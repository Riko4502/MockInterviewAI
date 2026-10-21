# План реализации: синхронизация таймзоны в дашборде

## 1. `DashboardUpcomingSession.tsx` (EDIT)
- [x] Импорт `useCurrentUser` (через `useViewerTimezone()`)
- [x] Вычислить `userTimezone` из `useViewerTimezone()` (см. [1]; требует backend-предпосылки [B], §2.1 спецификации правил)
- [x] Заменить использование `useState("UTC")` и все места, где использовался локальный стейт
- [x] Применить `userTimezone` к форматированиям

## 2. `DashboardRecentSessions.tsx` (EDIT)
- [x] Аналогично п.1

## 3. Тесты
- [x] Проверка использования профильной таймзоны (`DashboardUpcomingSession.test.tsx`, `dashboard-analytics.test.tsx`)

## 4. Проверки
- [x] tsc без ошибок
- [x] Нет прямых импортов дат при изменениях форматирования
