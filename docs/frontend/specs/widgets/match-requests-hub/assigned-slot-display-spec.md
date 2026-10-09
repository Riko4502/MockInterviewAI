# Спецификация: отображение назначенного слота в центре заявок (widgets/match-requests-hub)

## 1. Цель

Отображать выбранный/забронированный слот заявки (`req.slot`) во входящих и исходящих заявках, а также показывать баннер запланированного интервью при `status === 'ACCEPTED'`.

## 2. Контракты

`req.slot` (из MatchRequestResponseDto) содержит:
- `startsAt` (UTC)
- `durationMinutes`
- `status` (`OPEN` | `BOOKED` | `CANCELLED`) — в контексте заявки обычно `BOOKED` после принятия

## 3. Требования

- Форматирование **в таймзоне смотрящего** (`viewerTimezone`): `formatInstantInTimeZone(req.slot.startsAt, viewerTimezone, 'd MMMM yyyy, HH:mm')`
- Плашка слота: иконки Calendar/Clock (при наличии в `@packages/icons`), дата+время, длительность `${durationMinutes} мин`, статус слота (`OPEN`/`BOOKED`)
- Показывать плашку только если `req.slot` присутствует
- `MatchedSessionBanner`: при `req.status === 'ACCEPTED'` отображать «Интервью запланировано на {formattedDate}». Брать время из `req.slot?.startsAt` (или `scheduledAt` при наличии). Формат `'d MMMM yyyy, HH:mm'` в `viewerTimezone`

## 4. Файлы правки

| Файл | Тип | Описание |
|---|---|---|
| `widgets/match-requests-hub/ui/IncomingRequestCard.tsx` | EDIT | Добавить блок слота при наличии `req.slot` |
| `widgets/match-requests-hub/ui/OutgoingRequestCard.tsx` | EDIT | Добавить блок слота при наличии `req.slot` |
| `widgets/match-requests-hub/ui/MatchedSessionBanner.tsx` | EDIT | Баннер запланированного интервью с датой в `viewerTimezone` |

## 5. Источник viewerTimezone

`useCurrentUser()` → `user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"`

## 6. Тест-кейсы

- [ ] IncomingRequestCard: при наличии `req.slot` отображает дату/время/длительность/статус в `viewerTimezone`
- [ ] OutgoingRequestCard: аналогично
- [ ] При отсутствии `req.slot` — блок не отображается
- [ ] MatchedSessionBanner при ACCEPTED показывает «Интервью запланировано на...» с корректным форматом

## 7. Связи

- `@packages/utils/datetime`
- `@packages/icons` (опц.)
- `@packages/api`
