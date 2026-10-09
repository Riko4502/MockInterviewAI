# Спецификация: конструктор слотов в форме анкеты (features/manage-showcase-card)

## 1. Цель

Добавить конструктор слотов доступности в форму создания/редактирования анкеты (`ShowcaseCardForm`/`EditCardView`). Автор указывает слоты в **своей таймзоне** (`authorTimezone`), форма маппит их в DTO (`startsAtLocal` + `durationMinutes`).

## 2. Контракты

UI-форма содержит массив `slots`:
```ts
export const slotItemSchema = z.object({
  id: z.string().optional(), // для существующих слотов
  startsAtLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Формат YYYY-MM-DDTHH:mm"),
  durationMinutes: z.number().int().min(15).max(240).default(60),
})
```

Маппинг в DTO:
```ts
slots: values.slots && values.slots.length > 0
  ? values.slots.map(s => ({ startsAtLocal: s.startsAtLocal, durationMinutes: s.durationMinutes }))
  : undefined
```

## 3. Бизнес-правила

- От 1 до 10 слотов на карточку. `max(10)`. Кнопка «Добавить слот» дизейблится при достижении лимита.
- `startsAtLocal` в формате `YYYY-MM-DDTHH:mm`.
- Длительность: 15–240 минут. В UI — пресеты 30,45,60,90,120.
- Запрет добавления слота **в прошлом** (сравнение в `authorTimezone`).
- Запрет удаления **BOOKED**-слота. В форме редактирования BOOKED-слот помечается бейджем `slots.booked`, кнопка удаления дизейблится.
- При редактировании: маппинг `startsAt` (UTC) → `startsAtLocal` в `userTimezone` (author).
- Сервер проверяет round-trip (DST). Фронт отображает ошибку API при 422 при необходимости.

## 4. Компоненты и правки

| Файл | Тип | Описание |
|---|---|---|
| `features/manage-showcase-card/model/showcase-form-schema.ts` | EDIT | Добавить `slotItemSchema`, `slots` (max 10, optional), обновить `toCreateShowcaseCardDto`, `toUpdateShowcaseCardDto`. Клиентский refine «не в прошлом». |
| `features/manage-showcase-card/ui/SlotPickerField.tsx` | NEW | FieldArray (`useFieldArray`). Поля: дата, время начала, длительность (30,45,60,90,120). Кнопка `slots.addSlot`. Список плашек с удалением. Подсказка `slots.timeInYourTimezone`. Блокировка добавления при лимите/прошлом. Блокировка удаления BOOKED. |
| `features/manage-showcase-card/ui/ShowcaseCardLivePreview.tsx` | EDIT | Отображать локальные слоты формы в live-preview в `authorTimezone`. |
| `features/manage-showcase-card/ui/EditCardView.tsx` | EDIT | Инициализация: `card.slots` (UTC) → `{ id, startsAtLocal: formatInstantInTimeZone(startsAt, userTimezone,"yyyy-MM-dd'T'HH:mm"), durationMinutes, booked: status==='BOOKED' }` |
| `features/manage-showcase-card/ui/ShowcaseCardForm.tsx` | EDIT | Интегрировать `SlotPickerField` с заголовком `slots.title` |

## 5. i18n

Ключи: `slots.title`, `slots.addSlot`, `slots.addSlotDisabledMax`, `slots.booked`, `slots.cannotDeleteBooked`, `slots.cannotAddInPast`, `slots.timeInYourTimezone`, `slots.duration`, `slots.date`, `slots.startTime`, `slots.durationMinutes`.

## 6. Тест-кейсы

- [ ] Добавление валидного слота
- [ ] Нельзя добавить слот в прошлом
- [ ] Достигнут лимит 10 — кнопка «Добавить слот» дизейблится
- [ ] Удаление не-BOOKED слота
- [ ] BOOKED-слот нельзя удалить (кнопка дизейблится, бейдж)
- [ ] Live-preview отображает добавленные слоты
- [ ] EditView корректно маппит UTC→startsAtLocal
- [ ] Маппер формы не передаёт пустой массив

## 7. Связи

- `@packages/utils/datetime` — форматирование при инициализации, проверка «не в прошлом»
- `@packages/i18n`
- `@packages/dto`/`@packages/api`
