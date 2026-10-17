# План реализации: отображение слотов доступности в витрине

## 1. Задачи

### 1.1. Создать `ShowcaseSlotBadge.tsx` (NEW)
Путь: `apps/web/src/entities/showcase-card/ui/ShowcaseSlotBadge.tsx`

- [x] Импорт `formatInstantInTimeZone` из `@packages/utils` (подпуть `@packages/utils/datetime` отсутствует)
- [x] Импорт `useTranslation('showcase')`
- [x] Пропсы: `slot: Pick<AvailabilitySlot,'startsAt'|'durationMinutes'>`, `viewerTimezone: string`, `className?: string` (+ опциональный `locale`)
- [x] Формат времени: `'EEE, d MMM HH:mm'`
- [x] Отображение длительности: `${durationMinutes} ${t('slots.durationMinutes', { count: durationMinutes })}`
- [x] Компактный бейдж (chip/badge)

### 1.2. Создать `ShowcaseSlotsList.tsx` (NEW)
Путь: `apps/web/src/entities/showcase-card/ui/ShowcaseSlotsList.tsx`

- [x] Импорт `ShowcaseSlotBadge`, `useTranslation('showcase')`, тип `AvailabilitySlot` из `@packages/types` (общий тип — см. §2.1 спецификации правил)
- [x] Пропсы: `slots: AvailabilitySlot[]`, `viewerTimezone: string`, `maxVisible?: number` (default 3)
- [x] Фильтрация: `s.status==='OPEN' && new Date(s.startsAt) > new Date()`
- [x] Сортировка: по `startsAt` asc
- [x] Вычислить `visible = filtered.slice(0, maxVisible)`, `hiddenCount = filtered.length - maxVisible`
- [x] Рендер: заголовок `slots.upcomingSlots`, список бейджей, при `hiddenCount>0` — `t('slots.moreCount', { count: hiddenCount })`
- [x] Если `filtered.length === 0` — не рендерить блок

### 1.3. Создать `format-card-slot.ts` (NEW)
Путь: `apps/web/src/entities/showcase-card/lib/format-card-slot.ts`

- [x] Экспорт `formatCardSlot(instant: string|Date, tz: string, duration: number): string`
- [x] Использовать `formatInstantInTimeZone(instant, tz, 'd MMMM, HH:mm')` + вычисленный конец (без текстовых единиц, поэтому не требует i18n)
- [x] Возвращать человеко-понятную строку интервала

### 1.4. Правка `ShowcaseCard.tsx` (EDIT)
Путь: `apps/web/src/entities/showcase-card/ui/ShowcaseCard.tsx`

- [x] Получить `viewerTimezone` из `useViewerTimezone()` (см. [1]; требует backend-предпосылки [B], §2.1)
- [x] Импорт `ShowcaseSlotsList`
- [x] При наличии `card.slots` отрендерить `<ShowcaseSlotsList slots={card.slots} viewerTimezone={viewerTimezone} />`

## 2. Тестирование

Создать `ShowcaseSlotsList.test.tsx` (по желанию в `__tests__` рядом с компонентом):

- [x] Фильтрует прошедшие слоты (status OPEN, но startsAt < now)
- [x] Фильтрует BOOKED/CANCELLED
- [x] Сортирует по startsAt asc
- [x] Показывает максимум 3, `+N ещё` при >3
- [x] Не рендерит блок при пустом результате

## 3. Проверки

- [x] `pnpm --filter web exec tsc --noEmit` — без ошибок
- [x] Нет прямых импортов дат в новых файлах
- [x] Используются типы `@packages/api`/`@packages/types`
- [x] i18n-ключи корректны
