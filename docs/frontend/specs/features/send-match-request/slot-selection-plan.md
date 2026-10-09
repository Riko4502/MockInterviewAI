# План реализации: выбор слота при отправке отклика

## 1. `SlotSelectorRadioGroup.tsx` (NEW)
Путь: `apps/web/src/features/send-match-request/ui/SlotSelectorRadioGroup.tsx`

- [ ] Пропсы: `slots: AvailabilitySlot[]`, `value?: string`, `onChange: (slotId:string)=>void`, `viewerTimezone: string`, `disabled?: boolean`
- [ ] Фильтр: `status==='OPEN' && new Date(startsAt)>new Date()`
- [ ] Сортировка по `startsAt` asc
- [ ] Если пусто — ничего не рендерить
- [ ] Радиогруппа с доступными метками (дата+время+длительность)
- [ ] Заголовок `slots.chooseSlot`

## 2. `SendMatchRequestDialog.tsx` (EDIT)
Путь: `apps/web/src/features/send-match-request/ui/SendMatchRequestDialog.tsx`

- [ ] Получить `viewerTimezone` (профиль) + фоллбэки
- [ ] Вычислить `availableOpenSlots` и `hasOpenSlots`
- [ ] `const [selectedSlotId, setSelectedSlotId] = useState<string>()`
- [ ] Интегрировать `SlotSelectorRadioGroup`
- [ ] `disabled = submitting || (hasOpenSlots && !selectedSlotId)`
- [ ] Payload: `{ ..., slotId: hasOpenSlots ? selectedSlotId : undefined }`
- [ ] `onError` (мутация): при 409 → toast.error(t('slots.slotConflict')), `queryClient.invalidateQueries` по целевой карточке, `setSelectedSlotId(undefined)`. Не закрывать диалог
- [ ] Показать подсказку при `hasOpenSlots && !selectedSlotId` (можно использовать `slots.selectSlotRequired`)

## 3. Тесты
- [ ] `SendMatchRequestDialog.test.tsx` по кейсам спецификации

## 4. Проверки
- [ ] tsc без ошибок
- [ ] Корректная обработка 409
- [ ] slotId передаётся только при наличии выбора
