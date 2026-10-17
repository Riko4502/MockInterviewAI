# План реализации: отображение назначенного слота в центре заявок

## 1. `IncomingRequestCard.tsx` (EDIT)
- [x] Получить `viewerTimezone` из `useViewerTimezone()` (см. [1]; требует backend-предпосылки [B], §2.1 спецификации правил)
- [x] Если `req.slot` существует — рендер акцентной плашки слота (Calendar/Clock при наличии), дата+время (`d MMMM yyyy, HH:mm`), длительность, статус (`OPEN`/`BOOKED`)
- [x] Не ломать существующую структуру

## 2. `OutgoingRequestCard.tsx` (EDIT)
- [x] Аналогично п.1

## 3. `MatchedSessionBanner.tsx` (EDIT)
- [x] При `req.status === 'ACCEPTED'` отобразить баннер с текстом «Интервью запланировано на {formattedDate}»
- [x] Форматировать `req.slot?.startsAt` (приоритет) или `scheduledAt` в `viewerTimezone`, формат `'d MMMM yyyy, HH:mm'`

## 4. Тесты
- [x] Unit-тесты для трёх компонентов по кейсам спецификации

## 5. Проверки
- [x] tsc без ошибок
- [x] Только `@packages/utils`
