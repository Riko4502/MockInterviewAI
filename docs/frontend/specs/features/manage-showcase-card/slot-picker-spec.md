# Спецификация: конструктор слотов в форме анкеты (features/manage-showcase-card)

## 1. Цель

Добавить конструктор слотов доступности в форму создания/редактирования анкеты (`ShowcaseCardForm`/`EditCardView`). Автор указывает слоты в **своей таймзоне** (`authorTimezone`), форма маппит их в DTO (`startsAtLocal` + `durationMinutes`).

## 2. Контракты

UI-форма содержит массив `slots`:
```ts
export const slotItemSchema = z.object({
  id: z.string().optional(), // для существующих слотов (useFieldArray), на сервер не уходит
  startsAtLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Формат YYYY-MM-DDTHH:mm"),
  durationMinutes: z.number().int().min(15).max(240).default(60),
  booked: z.boolean().optional(), // true для BOOKED-слотов (только для UI)
})
```

Маппинг в DTO (**BOOKED-слоты исключаются**):
```ts
slots: values.slots && values.slots.some(s => !s.booked)
  ? values.slots
      .filter(s => !s.booked)
      .map(s => ({ startsAtLocal: s.startsAtLocal, durationMinutes: s.durationMinutes }))
  : undefined
```

> **Почему фильтр обязателен.** `replaceSlots` на бэкенде передаёт занятые заявкой слоты как `existing` и для каждого присланного слота проверяет пересечение (`showcase.service.ts` → `resolveSlots` + `assertNoOverlap`). Если BOOKED-слот попадёт в `slots`, он пересечётся сам с собой → `409 Conflict`. BOOKED-слоты не нужно пересылать: сервер сохраняет их без изменений.

## 3. Бизнес-правила

- От 1 до 10 слотов на карточку. `max(10)`. Кнопка «Добавить слот» дизейблится при достижении лимита.
- `startsAtLocal` в формате `YYYY-MM-DDTHH:mm`.
- Длительность: 15–240 минут. В UI — пресеты 30,45,60,90,120.
- Запрет добавления слота **в прошлом**: `const res = resolveLocalTimeToUtc(startsAtLocal, authorTimezone)`; валидно при `res.ok && res.utc > new Date()`; при `res.reason === "nonexistent"` (DST) — невалидно. Та же семантика, что у сервера.
- Запрет удаления **BOOKED**-слота. В форме редактирования BOOKED-слот помечается бейджем `slots.booked`, кнопка удаления дизейблится.
- **BOOKED-слоты не сериализуются** в `slots` (см. §2). В форме они остаются для показа, но в DTO не входят.
- **Свободный текст `scheduleInfo` вытесняется слотами** (ADR-002:63). Пока в форме задан хотя бы один слот, блок «Удобное время и формат» (`form.scheduleLabel`) не отображается; при отсутствии слотов — показывается как раньше. Это зеркалит правило бэкенда (`showcase.mapper.ts` → `hasSlots ? { scheduleInfo: null } : {}`) и убирает «два ответа на один вопрос» из формы.
- **Лимит 1–10** считается по отправляемым (не-BOOKED) слотам; сервер считает `kept + created` без BOOKED. Не применять `max(10)` к массиву, содержащему BOOKED, иначе валидация разойдётся с сервером.
- При редактировании: маппинг `startsAt` (UTC) → `startsAtLocal` в `userTimezone` (author).
- Сервер проверяет round-trip (DST). Фронт отображает ошибку API при 422 при необходимости.

## 4. Компоненты и правки

| Файл | Тип | Описание |
|---|---|---|
| `features/manage-showcase-card/model/showcase-form-schema.ts` | EDIT | Добавить `slotItemSchema`, `slots` (max 10, optional), обновить `toCreateShowcaseCardDto`, `toUpdateShowcaseCardDto`. Клиентский refine «не в прошлом». |
| `features/manage-showcase-card/ui/SlotPickerField.tsx` | NEW | FieldArray (`useFieldArray`). Поля: дата, время начала, длительность (30,45,60,90,120). Кнопка `slots.addSlot`. Список плашек с удалением. Подсказка `slots.timeInYourTimezone`. Блокировка добавления при лимите/прошлом. Блокировка удаления BOOKED. |
| `features/manage-showcase-card/ui/ShowcaseCardLivePreview.tsx` | EDIT | Отображать локальные слоты формы в live-preview в `authorTimezone`. |
| `features/manage-showcase-card/ui/EditCardView.tsx` | EDIT | Инициализация: `card.slots` (UTC) → `{ id, startsAtLocal: formatInstantInTimeZone(startsAt, userTimezone,"yyyy-MM-dd'T'HH:mm"), durationMinutes, booked: status==='BOOKED' }` |
| `features/manage-showcase-card/ui/ShowcaseCardForm.tsx` | EDIT | Интегрировать `SlotPickerField` с заголовком `slots.title`; скрывать блок `scheduleInfo` при наличии слотов |

## 5. i18n

Ключи: `slots.title`, `slots.addSlot`, `slots.addSlotDisabledMax`, `slots.booked`, `slots.cannotDeleteBooked`, `slots.cannotAddInPast`, `slots.timeInYourTimezone`, `slots.duration`, `slots.date`, `slots.startTime`, `slots.durationMinutes`.

## 6. Тест-кейсы

- [x] Добавление валидного слота
- [x] Нельзя добавить слот в прошлом
- [x] Достигнут лимит 10 — кнопка «Добавить слот» дизейблится
- [x] Удаление не-BOOKED слота
- [x] BOOKED-слот нельзя удалить (кнопка дизейблится, бейдж)
- [x] Live-preview отображает добавленные слоты
- [x] EditView корректно маппит UTC→startsAtLocal
- [x] Маппер формы не передаёт пустой массив
- [x] BOOKED-слоты **не попадают** в `slots` DTO (тест на `toUpdateShowcaseCardDto` с BOOKED+OPEN)
- [x] Если все слоты BOOKED — `slots` не передаётся (`undefined`)
- [x] Тест «не в прошлом» фиксирует часы (`vi.useFakeTimers()`/`setSystemTime`)

## 7. Связи

- `@packages/utils` — форматирование при инициализации, проверка «не в прошлом» (`resolveLocalTimeToUtc`)
- `@packages/i18n`
- `@packages/dto`/`@packages/api`
