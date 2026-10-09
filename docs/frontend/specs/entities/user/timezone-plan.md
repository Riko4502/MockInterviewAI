# План реализации: IANA-таймзоны

## 1. Создание утилит

### 1.1. `lib/timezones.ts` (NEW)
Путь: `apps/web/src/entities/user/lib/timezones.ts`

- [ ] Определить тип `TimeZoneItem = { id: string; label: string; region: string }`
- [ ] Сформировать `POPULAR_TIMEZONES` (минимальный набор: Europe/Moscow, Europe/London, Europe/Berlin, Europe/Kyiv, Europe/Paris, Asia/Tokyo, Asia/Shanghai, Asia/Singapore, Asia/Kolkata, Asia/Dubai, America/New_York, America/Los_Angeles, America/Chicago, America/Toronto, America/Sao_Paulo, Africa/Cairo, Australia/Sydney, UTC)
- [ ] `getBrowserTimezone() = () => Intl.DateTimeFormat().resolvedOptions().timeZone`
- [ ] `groupTimezones(items)` — группировка по `region`

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

- [ ] Unit-тест: автодетект устанавливает зону браузера
- [ ] Фильтрация по поиску
- [ ] Корректная группировка

## 4. Проверки

- [ ] `tsc --noEmit` без ошибок
- [ ] Использует i18n-ключи
- [ ] Без прямых импортов дат
