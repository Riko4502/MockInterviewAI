# План реализации: конструктор слотов в форме анкеты

## 1. `showcase-form-schema.ts` (EDIT)
Путь: `apps/web/src/features/manage-showcase-card/model/showcase-form-schema.ts`

- [ ] Импорт утилит из `@packages/utils` (при необходимости для проверки; подпуть `@packages/utils/datetime` отсутствует)
- [ ] Добавить `slotItemSchema` (id опц., `startsAtLocal` regex, `durationMinutes` 15–240 default 60). Поле `id` — только для `useFieldArray` и **не** уходит на сервер (в `CreateShowcaseCardDtoSlotsItem` его нет)
- [ ] Добавить `slots: z.array(slotItemSchema).max(10).optional()`
- [ ] Добавить клиентский `.refine`/`superRefine` проверки «не в прошлом»: `const res = resolveLocalTimeToUtc(startsAtLocal, authorTimezone)` → валидно при `res.ok && res.utc > new Date()`, `res.reason === "nonexistent"` → невалидно. Текст ошибки через i18n или ключ `slots.cannotAddInPast`
- [ ] Обновить `toCreateShowcaseCardDto`, `toUpdateShowcaseCardDto`: **фильтровать BOOKED** (`filter(s => !s.booked)`) перед маппингом; если после фильтра пусто — `slots: undefined`. BOOKED в payload → `409` из `replaceSlots`
- [ ] Сохранить обратную совместимость (undefined при пустом)

## 2. `SlotPickerField.tsx` (NEW)
Путь: `apps/web/src/features/manage-showcase-card/ui/SlotPickerField.tsx`

- [ ] `useFieldArray({ control, name: "slots" })`
- [ ] Поля: `<input type="date">`, `<input type="time">`, Select (30,45,60,90,120)
- [ ] Проверка при добавлении: `startsAtLocal = date+'T'+time`, валидация формата, «не в прошлом» через `resolveLocalTimeToUtc` в `authorTimezone`, лимит по не-BOOKED слотам
- [ ] Список плашек: отображение времени, кнопка удаления. BOOKED (флаг `booked`) — дизейбл, бейдж `slots.booked`, тултип `slots.cannotDeleteBooked`
- [ ] Подсказка `slots.timeInYourTimezone`

## 3. `ShowcaseCardLivePreview.tsx` (EDIT)
- [ ] Отображать `formValues.slots` (локальные) в превью, форматировать представление в `authorTimezone`

## 4. `EditCardView.tsx` (EDIT)
- [ ] defaultValues.slots: маппинг UTC→startsAtLocal в `authorTimezone` (`formatInstantInTimeZone`), добавить флаг `booked = status==='BOOKED'`
- [ ] `authorTimezone`: `const { data: user } = useCurrentUser()` → `user?.timezone || "UTC"` (требует backend-предпосылки [B], §2.1)

## 5. `ShowcaseCardForm.tsx` (EDIT)
- [ ] Интегрировать `<SlotPickerField control={form.control} userTimezone={userTimezone} />`

## 6. Обработка ошибок API
- [ ] `422 Unprocessable Entity` (несуществующее локальное время в зоне автора, DST): показать сообщение от API пользователю, не теряя введённые слоты
- [ ] Прочие ошибки создания/обновления — существующим тостом

## 7. Тесты
- [ ] `ShowcaseCardForm.test.tsx` по кейсам спецификации
- [ ] Мэппер: BOOKED+OPEN → в DTO только OPEN; все BOOKED → `slots: undefined`
- [ ] «Не в прошлом» — с фиксацией часов (`vi.useFakeTimers()`/`setSystemTime`, сброс `useRealTimers`)

## 8. Проверки
- [ ] tsc без ошибок, без прямых импортов дат
