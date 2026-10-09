# Спецификация: выбор слота при отправке отклика (features/send-match-request)

## 1. Цель

Сделать выбор слота **обязательным**, если у целевой карточки есть открытые актуальные слоты. Корректно обработать гонку бронирования (`409 Conflict`).

## 2. Бизнес-правила

- Если у карточки есть >=1 открытый слот (`status==='OPEN'` и `startsAt > now()`) — `slotId` обязателен для отправки отклика.
- Фильтрация: только `OPEN` + future, сортировка по `startsAt` asc.
- При ответе `409 Conflict` на создание заявки: показать Toast `slots.slotConflict`, `queryClient.invalidateQueries` по целевой карточке, **сбросить** выбранный `slotId`, **не закрывать** диалог.
- Если открытых слотов нет — блок выбора не показывать, `slotId` не передавать (`undefined`).
- Форматирование слотов в диалоге — в `viewerTimezone`.

## 3. Компоненты

| Файл | Тип | Описание |
|---|---|---|
| `features/send-match-request/ui/SlotSelectorRadioGroup.tsx` | NEW | Радиогруппа доступных слотов. Заголовок `slots.chooseSlot`. Отображение даты/времени + длительности в `viewerTimezone`. |
| `features/send-match-request/ui/SendMatchRequestDialog.tsx` | EDIT | Интеграция радиогруппы. Локальный стейт `selectedSlotId`. Блокировка submit при `hasOpenSlots && !selectedSlotId`. В payload — `slotId: hasOpenSlots ? selectedSlotId : undefined`. Обработка 409 в `onError`. |

## 4. Формат отображения

`formatInstantInTimeZone(slot.startsAt, viewerTimezone, 'd MMMM, HH:mm')` + `(${durationMinutes} ${t('slots.durationMinutes', {count: durationMinutes})})`

## 5. i18n

Ключи: `slots.chooseSlot`, `slots.selectSlotRequired`, `slots.slotConflict`, `slots.durationMinutes`.

## 6. Тест-кейсы

- [ ] При наличии OPEN-слотов кнопка заблокирована до выбора
- [ ] Выбор слота → `slotId` передаётся в мутацию
- [ ] 409 Conflict → toast показан, `invalidateQueries` вызван, `slotId` сброшен, диалог не закрыт
- [ ] При отсутствии слотов — блок выбора не отображается, отправка без `slotId`
- [ ] Фильтрация прошедших/BOOKED

## 7. Связи

- `@packages/utils/datetime`
- `@tanstack/react-query` — invalidateQueries
- `@packages/i18n`
- `@packages/api`
