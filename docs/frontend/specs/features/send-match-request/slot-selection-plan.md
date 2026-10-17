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
- [x] Вычислить `availableOpenSlots` и `hasOpenSlots`
- [x] `const [selectedSlotId, setSelectedSlotId] = useState<string>()`
- [x] Интегрировать `SlotSelectorRadioGroup`
- [x] `disabled = submitting || (hasOpenSlots && !isSelectedSlotAvailable)` — валидность считается по свежему списку OPEN+future, а не просто по `!selectedSlotId`
- [x] Payload: `{ ..., slotId: hasOpenSlots && isSelectedSlotAvailable ? selectedSlotId : undefined }`
- [x] `onError` (мутация): при `409` → toast.error(t('slots.slotConflict')), `queryClient.invalidateQueries` по целевой карточке, `setSelectedSlotId(undefined)`. Не закрывать диалог
- [x] `onError`: при `400` — показать **фактическое сообщение сервера** (`extractErrorMessage`) + `invalidateQueries` карточки. Принудительный сброс выбора не нужен: устаревший `slotId` перестаёт быть валидным сам после рефетча. Маскировать любой `400` под «Выберите слот» нельзя — бэкенд отдаёт `400` и по другим причинам (профиль, лимит, кулдаун)
- [x] Инлайн-подсказку `slots.selectSlotRequired` не рендерить: блокировка submit + заголовок `slots.chooseSlot` достаточны, а инлайн-ошибка всплывала после сброса выбора при ошибке и вводила в заблуждение (ключ оставлен в i18n как резерв)

## 3. Тесты
- [ ] `SendMatchRequestDialog.test.tsx` по кейсам спецификации

## 4. Проверки
- [ ] tsc без ошибок
- [ ] Корректная обработка 409
- [ ] slotId передаётся только при наличии выбора
