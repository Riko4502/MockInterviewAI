# План реализации: выбор слота при отправке отклика

> Зависит только от [0] shared. `SlotSelectorRadioGroup` самостоятелен и не переиспользует компоненты [2], поэтому план не блокируется планом витрины.

## 1. `SlotSelectorRadioGroup.tsx` (NEW)
Путь: `apps/web/src/features/send-match-request/ui/SlotSelectorRadioGroup.tsx`

- [ ] Пропсы: `slots: AvailabilitySlot[]`, `value?: string`, `onChange: (slotId:string)=>void`, `viewerTimezone: string`, `disabled?: boolean` (тип `AvailabilitySlot` — общий, см. §2.1 спецификации правил; локальных дублей не создавать)
- [ ] Фильтр: `status==='OPEN' && new Date(startsAt)>new Date()`
- [ ] Сортировка по `startsAt` asc
- [ ] Если пусто — ничего не рендерить
- [ ] Радиогруппа с доступными метками (дата+время+длительность)
- [ ] Заголовок `slots.chooseSlot`

## 2. `SendMatchRequestDialog.tsx` (EDIT)
Путь: `apps/web/src/features/send-match-request/ui/SendMatchRequestDialog.tsx`

- [ ] Получить `viewerTimezone` из `useViewerTimezone()` (см. [1]; требует backend-предпосылки [B], §2.1)
- [ ] Вычислить `availableOpenSlots` и `hasOpenSlots`
- [ ] `const [selectedSlotId, setSelectedSlotId] = useState<string>()`
- [ ] Интегрировать `SlotSelectorRadioGroup`
- [ ] `disabled = submitting || (hasOpenSlots && !selectedSlotId)`
- [ ] Payload: `{ ..., slotId: hasOpenSlots ? selectedSlotId : undefined }`
- [ ] `onError` (мутация): при `409` → toast.error(t('slots.slotConflict')), `queryClient.invalidateQueries` по целевой карточке, `setSelectedSlotId(undefined)`. Не закрывать диалог
- [ ] `onError`: при `400` (устаревшие данные карточки — бэкенд требует `slotId`, если у карточки есть OPEN-слот, а клиент его не передал) — тот же путь: toast + `invalidateQueries` карточки + сброс выбора
- [ ] Показать подсказку при `hasOpenSlots && !selectedSlotId` (можно использовать `slots.selectSlotRequired`)

## 3. Тесты
- [ ] `SendMatchRequestDialog.test.tsx` по кейсам спецификации

## 4. Проверки
- [ ] tsc без ошибок
- [ ] Корректная обработка 409
- [ ] slotId передаётся только при наличии выбора
