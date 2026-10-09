# План реализации: конструктор слотов в форме анкеты

## 1. `showcase-form-schema.ts` (EDIT)
Путь: `apps/web/src/features/manage-showcase-card/model/showcase-form-schema.ts`

- [ ] Импорт утилит из `@packages/utils/datetime` (при необходимости для проверки)
- [ ] Добавить `slotItemSchema` (id опц., `startsAtLocal` regex, `durationMinutes` 15–240 default 60)
- [ ] Добавить `slots: z.array(slotItemSchema).max(10).optional()`
- [ ] Добавить клиентский `.refine`/`superRefine` проверки «не в прошлом» (сравнение в `user.timezone`). Текст ошибки через i18n или ключ `slots.cannotAddInPast`
- [ ] Обновить `toCreateShowcaseCardDto`, `toUpdateShowcaseCardDto` (маппинг как в спецификации)
- [ ] Сохранить обратную совместимость (undefined при пустом)

## 2. `SlotPickerField.tsx` (NEW)
Путь: `apps/web/src/features/manage-showcase-card/ui/SlotPickerField.tsx`

- [ ] `useFieldArray({ control, name: "slots" })`
- [ ] Поля: `<input type="date">`, `<input type="time">`, Select (30,45,60,90,120)
- [ ] Проверка при добавлении: `startsAtLocal = date+'T'+time`, валидация формата, «не в прошлом» в `userTimezone`, лимит 10
- [ ] Список плашек: отображение времени, кнопка удаления. BOOKED (флаг `booked`) — дизейбл, бейдж `slots.booked`, тултип `slots.cannotDeleteBooked`
- [ ] Подсказка `slots.timeInYourTimezone`

## 3. `ShowcaseCardLivePreview.tsx` (EDIT)
- [ ] Отображать `formValues.slots` (локальные) в превью, форматировать представление в `authorTimezone`

## 4. `EditCardView.tsx` (EDIT)
- [ ] defaultValues.slots: маппинг UTC→startsAtLocal в `userTimezone` (`formatInstantInTimeZone`), добавить флаг `booked = status==='BOOKED'`

## 5. `ShowcaseCardForm.tsx` (EDIT)
- [ ] Интегрировать `<SlotPickerField control={form.control} userTimezone={userTimezone} />`

## 6. Тесты
- [ ] `ShowcaseCardForm.test.tsx` по кейсам спецификации

## 7. Проверки
- [ ] tsc без ошибок, без прямых импортов дат
