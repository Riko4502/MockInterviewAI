# Спецификация: счётчики слотов в «Моих анкетах» (widgets/my-cards-list)

## 1. Цель

В `MyCardItem.tsx` добавить бейджи со счётчиками слотов: «Свободно: X / Забронировано: Y».

## 2. Правила подсчёта

- `freeCount = card.slots.filter(s => s.status === 'OPEN').length`
- `bookedCount = card.slots.filter(s => s.status === 'BOOKED').length`
- Подсчёт по всем слотам карточки (без фильтрации по времени)

## 3. UI

- Отобразить бейджи с ключами `slots.freeCount` и `slots.bookedCount`
- При клике — переход к управлению/редактированию анкеты (существующий роут редактирования)
- Сохранить существующую логику клика/структуру

## 4. Файл правки

- `widgets/my-cards-list/ui/MyCardItem.tsx` (EDIT)

## 5. i18n

Ключи: `slots.freeCount`, `slots.bookedCount`

## 6. Тест-кейсы

- [ ] Корректные счётчики при наличии OPEN/BOOKED
- [ ] При пустых слотах — 0/0
- [ ] Учитываются только статусы OPEN/BOOKED

## 7. Связи

- `@packages/i18n`
- `@packages/api` (типы слотов)
