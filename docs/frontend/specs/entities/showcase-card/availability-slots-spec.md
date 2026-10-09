# Спецификация: отображение слотов доступности в витрине (entities/showcase-card)

## 1. Цель

Реализовать отображение открытых слотов доступности карточки в витрине. Показывать **только** актуальные `OPEN`-слоты (`startsAt > now()`) с форматированием **в таймзоне смотрящего** (`viewerTimezone`).

## 2. Контракты данных

Используются типы из `@packages/api`/`@packages/dto`:

| Поле | Описание |
|---|---|
| `slot.id` | UUID слота |
| `slot.startsAt` | UTC-инстант (ISO 8601). Форматируется только через `formatInstantInTimeZone`. |
| `slot.durationMinutes` | Длительность в минутах (15–240) |
| `slot.status` | `'OPEN' \| 'BOOKED' \| 'CANCELLED'` |

## 3. Бизнес-правила

- Отображать **только** `status === 'OPEN'` и `startsAt > now()` (актуальные будущие слоты).
- Сортировать по возрастанию `startsAt`.
- В блоке витрины показывать **не более 3** ближайших слотов.
- Если после фильтрации > 3 слотов — выводить счётчик `+N ещё` (`slots.moreCount`).
- Форматирование времени **строго** в `viewerTimezone` через `@packages/utils/datetime.formatInstantInTimeZone`.
- Заголовок блока: `slots.upcomingSlots`.

## 4. Компоненты

| Файл | Тип | Описание |
|---|---|---|
| `entities/showcase-card/ui/ShowcaseSlotBadge.tsx` | NEW | Компактный бейдж слота. Показывает время старта в `viewerTimezone` + длительность. Формат показа: `'EEE, d MMM HH:mm'` (по смыслу краткого бейджа). |
| `entities/showcase-card/ui/ShowcaseSlotsList.tsx` | NEW | Список актуальных OPEN-слотов. Фильтрация+сортировка, `maxVisible = 3` по умолчанию, рендер бейджей, показ `+N ещё`. |
| `entities/showcase-card/lib/format-card-slot.ts` | NEW | Хелпер форматирования интервала (начало + длительность). Экспорт `formatCardSlot(instant: string\|Date, tz: string, duration: number)`. Использует `@packages/utils/datetime`. |
| `entities/showcase-card/ui/ShowcaseCard.tsx` | EDIT | Добавить блок «Ближайшие слоты» при наличии >=1 актуального OPEN-слота. Передавать `viewerTimezone`. |

## 5. Таймзона (viewerTimezone)

Источник: `useCurrentUser()` → `user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"`.
Никогда не использовать таймзону автора карточки для отображения в витрине другому пользователю.

## 6. i18n

Ключи: `slots.upcomingSlots`, `slots.moreCount`, `slots.durationMinutes`.

## 7. Тест-кейсы

- [ ] Рендерятся только `OPEN` и будущие слоты (прошедшие отфильтровываются)
- [ ] Сортировка по `startsAt` по возрастанию
- [ ] Отображается максимум 3 бейджа, при >3 показан `+N ещё`
- [ ] Форматирование в переданном `viewerTimezone`
- [ ] Блок не рендерится, если нет актуальных слотов
- [ ] Типы из `@packages/api` используются без дублирования интерфейсов

## 8. Связи

- `@packages/utils/datetime` — форматирование
- `@packages/i18n` — тексты
- `@packages/api` — типы `AvailabilitySlot`/`ShowcaseCard`
