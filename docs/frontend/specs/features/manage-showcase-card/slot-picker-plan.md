# План реализации: конструктор слотов в форме анкеты

## 1. `showcase-form-schema.ts` (EDIT)
Путь: `apps/web/src/features/manage-showcase-card/model/showcase-form-schema.ts`

- [x] Импорт утилит из `@packages/utils` (при необходимости для проверки; подпуть `@packages/utils/datetime` отсутствует)
- [x] Добавить `slotItemSchema` (id опц., `startsAtLocal` regex, `durationMinutes` 15–240 default 60). Поле `id` — только для `useFieldArray` и **не** уходит на сервер (в `CreateShowcaseCardDtoSlotsItem` его нет). Используется `SLOT_DURATION_LIMITS` из `@packages/dto`.
- [x] Добавить `slots: z.array(slotItemSchema).optional()` + `superRefine`. Лимит 10 считается по **не-BOOKED** слотам (спека §2), а не `.max(10)` по всему массиву.
- [x] Добавить клиентский `.superRefine` проверки «не в прошлом»: `const res = resolveLocalTimeToUtc(startsAtLocal, authorTimezone)` → валидно при `res.ok && res.utc > new Date()`; BOOKED пропускаются. Текст ошибки через i18n `slots.cannotAddInPast`
- [x] Обновить `toCreateShowcaseCardDto`, `toUpdateShowcaseCardDto`: **фильтровать BOOKED** (`filter(s => !s.booked)`) перед маппингом; если после фильтра пусто — `slots: undefined`. BOOKED в payload → `409` из `replaceSlots`
- [x] Сохранить обратную совместимость (undefined при пустом); второй аргумент `authorTimezone` опционален (`"UTC"`), существующий вызов `createShowcaseFormSchema(mockT)` продолжает работать

## 2. `SlotPickerField.tsx` (NEW)
Путь: `apps/web/src/features/manage-showcase-card/ui/SlotPickerField.tsx`

- [x] `useFieldArray({ control, name: "slots" })`
- [x] Поля: `<input type="date">`, `<input type="time">`, Select (30,45,60,90,120)
- [x] Проверка при добавлении: `startsAtLocal = date+'T'+time`, валидация формата, «не в прошлом» через `resolveLocalTimeToUtc` в `authorTimezone`, лимит по не-BOOKED слотам
- [x] Список плашек: отображение времени, кнопка удаления. BOOKED (флаг `booked`) — дизейбл, бейдж `slots.booked`, тултип `slots.cannotDeleteBooked`
- [x] Подсказка `slots.timeInYourTimezone`

## 3. `ShowcaseCardLivePreview.tsx` (EDIT)
- [x] Отображать `formValues.slots` (локальные) в превью: `resolveLocalTimeToUtc` → UTC-инстанты `AvailabilitySlot[]`, форматирование уже в таймзоне смотрящего через `ShowcaseSlotsList`

## 4. `EditCardView.tsx` (EDIT)
- [x] defaultValues.slots: маппинг UTC→startsAtLocal в `authorTimezone` (`formatInstantInTimeZone`), добавить флаг `booked = status==='BOOKED'`. Прошедшие OPEN-слоты отфильтровываются (иначе блокируют валидацию), BOOKED сохраняются
- [x] `authorTimezone`: `const { data: user } = useCurrentUser()` → `user?.timezone || "UTC"`. Инициализация формы ожидает загрузки `user`

## 5. `ShowcaseCardForm.tsx` (EDIT)
- [x] Интегрировать `<SlotPickerField control={form.control} authorTimezone={authorTimezone} />`
- [x] Скрывать блок `scheduleInfo` («Удобное время и формат»), когда в форме есть хотя бы один слот (ADR-002:63, зеркалит `showcase.mapper.ts`)

## 6. Обработка ошибок API
- [x] `422 Unprocessable Entity` (несуществующее локальное время в зоне автора, DST): сообщение от API выводится существующим тостом (`extractErrorMessage` в `useShowcaseMutations`); форма не сбрасывается, введённые слоты сохраняются
- [x] Прочие ошибки создания/обновления — существующим тостом

## 7. Тесты
- [x] Покрытие кейсов спецификации: `SlotPickerField.test.tsx`, `ShowcaseCardLivePreview.test.tsx`, `showcase-form-schema.test.ts`, `EditCardView.test.tsx`, `ShowcaseCardForm.test.tsx`
- [x] Мэппер: BOOKED+OPEN → в DTO только OPEN; все BOOKED → `slots: undefined`
- [x] «Не в прошлом» — с фиксацией часов (`vi.useFakeTimers()`/`setSystemTime`, сброс `useRealTimers`)
- [x] `ShowcaseCardForm`: блок `scheduleInfo` скрыт при наличии слотов, показан при их отсутствии

## 8. Проверки
- [x] tsc без ошибок, без прямых импортов дат
