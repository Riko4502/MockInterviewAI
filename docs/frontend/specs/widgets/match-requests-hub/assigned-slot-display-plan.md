# План реализации: отображение назначенного слота в центре заявок

## 1. `IncomingRequestCard.tsx` (EDIT)
- [ ] Получить `viewerTimezone`
- [ ] Если `req.slot` существует — рендер акцентной плашки слота (Calendar/Clock при наличии), дата+время (`d MMMM yyyy, HH:mm`), длительность, статус (`OPEN`/`BOOKED`)
- [ ] Не ломать существующую структуру

## 2. `OutgoingRequestCard.tsx` (EDIT)
- [ ] Аналогично п.1

## 3. `MatchedSessionBanner.tsx` (EDIT)
- [ ] При `req.status === 'ACCEPTED'` отобразить баннер с текстом «Интервью запланировано на {formattedDate}»
- [ ] Форматировать `req.slot?.startsAt` (приоритет) или `scheduledAt` в `viewerTimezone`, формат `'d MMMM yyyy, HH:mm'`

## 4. Тесты
- [ ] Unit-тесты для трёх компонентов по кейсам спецификации

## 5. Проверки
- [ ] tsc без ошибок
- [ ] Только `@packages/utils/datetime`
