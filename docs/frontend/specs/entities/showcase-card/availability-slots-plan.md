# План реализации: отображение слотов доступности в витрине

## 1. Задачи

### 1.1. Создать `ShowcaseSlotBadge.tsx` (NEW)
Путь: `apps/web/src/entities/showcase-card/ui/ShowcaseSlotBadge.tsx`

- [ ] Импорт `formatInstantInTimeZone` из `@packages/utils/datetime`
- [ ] Импорт `useTranslation('showcase')`
- [ ] Пропсы: `slot: Pick<AvailabilitySlot,'startsAt'|'durationMinutes'>`, `viewerTimezone: string`, `className?: string`
- [ ] Формат времени: `'EEE, d MMM HH:mm'`
- [ ] Отображение длительности: `${durationMinutes} ${t('slots.durationMinutes', { count: durationMinutes })}`
- [ ] Компактный бейдж (chip/badge)

### 1.2. Создать `ShowcaseSlotsList.tsx` (NEW)
Путь: `apps/web/src/entities/showcase-card/ui/ShowcaseSlotsList.tsx`

- [ ] Импорт `ShowcaseSlotBadge`, `useTranslation('showcase')`, тип `AvailabilitySlot` из `@packages/api`
- [ ] Пропсы: `slots: AvailabilitySlot[]`, `viewerTimezone: string`, `maxVisible?: number` (default 3)
- [ ] Фильтрация: `s.status==='OPEN' && new Date(s.startsAt) > new Date()`
- [ ] Сортировка: по `startsAt` asc
- [ ] Вычислить `visible = filtered.slice(0, maxVisible)`, `hiddenCount = filtered.length - maxVisible`
- [ ] Рендер: заголовок `slots.upcomingSlots`, список бейджей, при `hiddenCount>0` — `t('slots.moreCount', { count: hiddenCount })`
- [ ] Если `filtered.length === 0` — не рендерить блок

### 1.3. Создать `format-card-slot.ts` (NEW)
Путь: `apps/web/src/entities/showcase-card/lib/format-card-slot.ts`

- [ ] Экспорт `formatCardSlot(instant: string|Date, tz: string, duration: number): string`
- [ ] Использовать `formatInstantInTimeZone(instant, tz, 'd MMMM, HH:mm')` + длительность
- [ ] Возвращать человеко-понятную строку интервала

### 1.4. Правка `ShowcaseCard.tsx` (EDIT)
Путь: `apps/web/src/entities/showcase-card/ui/ShowcaseCard.tsx`

- [ ] Получить `viewerTimezone`: `useCurrentUser()` → `user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"`
- [ ] Импорт `ShowcaseSlotsList`
- [ ] При наличии `card.slots` отрендерить `<ShowcaseSlotsList slots={card.slots} viewerTimezone={viewerTimezone} />`

## 2. Тестирование

Создать `ShowcaseSlotsList.test.tsx` (по желанию в `__tests__` рядом с компонентом):

- [ ] Фильтрует прошедшие слоты (status OPEN, но startsAt < now)
- [ ] Фильтрует BOOKED/CANCELLED
- [ ] Сортирует по startsAt asc
- [ ] Показывает максимум 3, `+N ещё` при >3
- [ ] Не рендерит блок при пустом результате

## 3. Проверки

- [ ] `pnpm --filter web exec tsc --noEmit` — без ошибок
- [ ] Нет прямых импортов дат в новых файлах
- [ ] Используются типы `@packages/api`
- [ ] i18n-ключи корректны
