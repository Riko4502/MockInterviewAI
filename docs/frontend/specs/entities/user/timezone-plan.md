# План реализации: IANA-таймзоны

> Зависит от [0] shared. Сохранение выбранной зоны в профиле требует backend-предпосылки [B] (`PATCH /profile/me` должен сохранять `timezone`, `GET /profile/me` — возвращать). Базовая зависимость для [2], [4], [5], [7], [8] (через `useViewerTimezone()`) и [3], [9] (через `TimezoneSelect`/`lib/timezones`).

## 1. Создание утилит

### 1.1. `lib/timezones.ts` (NEW)
Путь: `apps/web/src/entities/user/lib/timezones.ts`

- [ ] Определить тип `TimeZoneItem = { id: string; label: string; region: string }`
- [ ] Сформировать `POPULAR_TIMEZONES` (минимальный набор: Europe/Moscow, Europe/London, Europe/Berlin, Europe/Kyiv, Europe/Paris, Asia/Tokyo, Asia/Shanghai, Asia/Singapore, Asia/Kolkata, Asia/Dubai, America/New_York, America/Los_Angeles, America/Chicago, America/Toronto, America/Sao_Paulo, Africa/Cairo, Australia/Sydney, UTC)
- [ ] `getBrowserTimezone() = () => Intl.DateTimeFormat().resolvedOptions().timeZone`
- [ ] `groupTimezones(items)` — группировка по `region`

### 1.2. Создать `model/use-viewer-timezone.ts` (NEW)
Путь: `apps/web/src/entities/user/model/use-viewer-timezone.ts`

- [ ] Хук `useViewerTimezone(): string` — единый источник таймзоны смотрящего для всего приложения
- [ ] Внутри: `const { data: user } = useCurrentUser()` → `user?.timezone || getBrowserTimezone() || "UTC"`
- [ ] Опции `{ enabled?: boolean }` — прокидывать в `useCurrentUser` (публичные страницы без авторизации)
- [ ] Потребители берут таймзону отсюда, инлайн-фоллбэк не дублируют: [2] availability-slots, [4] slot-selection, [5] assigned-slot-display, [7] dashboard, [8] notification

## 2. Создание компонента

### 2.1. `ui/TimezoneSelect.tsx` (NEW)
Путь: `apps/web/src/entities/user/ui/TimezoneSelect.tsx`

- [ ] Импорт из `@packages/ui` (Select/Combobox по наличию)
- [ ] Импорт `useTranslation('showcase')`
- [ ] Импорт `POPULAR_TIMEZONES`, `getBrowserTimezone`, `groupTimezones`
- [ ] Пропсы: `value: string`, `onValueChange: (v:string)=>void`, `disabled?: boolean`, `className?: string`
- [ ] Состояние поиска (по `id`/`label`)
- [ ] Кнопка «Определить по браузеру» → `getBrowserTimezone()` и вызвать `onValueChange`
- [ ] Отображение с группировкой по регионам

## 3. Тестирование

- [ ] `useViewerTimezone`: профильная зона → зона браузера → `"UTC"`
- [ ] Unit-тест: автодетект устанавливает зону браузера
- [ ] Фильтрация по поиску
- [ ] Корректная группировка

## 4. Проверки

- [ ] `tsc --noEmit` без ошибок
- [ ] Использует i18n-ключи
- [ ] Без прямых импортов дат
