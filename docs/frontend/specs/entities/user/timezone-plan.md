# План реализации: IANA-таймзоны

> Зависит от [0] shared. Сохранение выбранной зоны в профиле требует backend-предпосылки [B] (`PATCH /profile/me` должен сохранять `timezone`, `GET /profile/me` — возвращать). Базовая зависимость для [2], [4], [5], [7], [8] (через `useViewerTimezone()`) и [3], [9] (через `TimezoneSelect`/`lib/timezones`).

## 1. Создание утилит

### 1.1. `lib/timezones.ts` (NEW)
Путь: `apps/web/src/entities/user/lib/timezones.ts`

- [x] Определить тип `TimeZoneItem = { id: string; label: string; region: string }`
- [x] Сформировать `POPULAR_TIMEZONE_IDS` (минимальный набор: Europe/Moscow, Europe/London, Europe/Berlin, Europe/Kyiv, Europe/Paris, Asia/Tokyo, Asia/Shanghai, Asia/Singapore, Asia/Kolkata, Asia/Dubai, America/New_York, America/Los_Angeles, America/Chicago, America/Toronto, America/Sao_Paulo, Africa/Cairo, Australia/Sydney, UTC) + полный список через `Intl.supportedValuesOf("timeZone")` (`getAllTimeZoneIds`/`buildTimeZoneList`) с фоллбэком на популярные
- [x] `getBrowserTimezone() = () => Intl.DateTimeFormat().resolvedOptions().timeZone`
- [x] `groupTimezones(items)` — группировка по `region` с сортировкой регионов/элементов

### 1.2. Создать `model/use-viewer-timezone.ts` (NEW)
Путь: `apps/web/src/entities/user/model/use-viewer-timezone.ts`

- [x] Хук `useViewerTimezone(): string` — единый источник таймзоны смотрящего для всего приложения
- [x] Внутри: `const { data: user } = useCurrentUser()` → `user?.timezone || getBrowserTimezone() || "UTC"`
- [x] Опции `{ enabled?: boolean }` — прокидывать в `useCurrentUser` (публичные страницы без авторизации)
- [x] Потребители берут таймзону отсюда, инлайн-фоллбэк не дублируют: [2] availability-slots, [4] slot-selection, [5] assigned-slot-display, [7] dashboard, [8] notification

## 2. Создание компонента

### 2.1. `ui/TimezoneSelect.tsx` (NEW)
Путь: `apps/web/src/entities/user/ui/TimezoneSelect.tsx`

- [x] Импорт из `@packages/ui` (добавлен generic `Combobox` в `@packages/ui`)
- [x] Импорт `useTranslation('showcase')`
- [x] Импорт `buildTimeZoneList`, `getBrowserTimezone`, `groupTimezones`
- [x] Пропсы: `value: string`, `onValueChange: (v:string)=>void`, `disabled?: boolean`, `className?: string`
- [x] Состояние поиска (по `id`/`label`) — реализовано внутри `Combobox`
- [x] Кнопка «Определить по браузеру» → `getBrowserTimezone()` и вызвать `onValueChange`
- [x] Отображение с группировкой по регионам (локализованные заголовки регионов через i18n)

## 3. Тестирование

- [x] `useViewerTimezone`: профильная зона → зона браузера → `"UTC"`
- [x] Unit-тест: автодетект устанавливает зону браузера
- [x] Фильтрация по поиску
- [x] Корректная группировка

## 4. Проверки

- [x] `tsc --noEmit` без ошибок
- [x] Использует i18n-ключи
- [x] Без прямых импортов дат
