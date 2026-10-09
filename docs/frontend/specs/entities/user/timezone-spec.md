# Спецификация: IANA-таймзоны (entities/user)

## 1. Цель

Добавить поддержку IANA-таймзон. Реализовать селектор таймзоны с поиском, группировкой по регионам и автодетектом браузера. Соблюдать **двухшаговую валидацию** IANA (ADR-002).

## 2. Требования по валидации (ADR-002)

- **Двухшаговая валидация.** Шаг 1 — формат через `isIanaTimeZoneFormat` (из `@packages/utils`). Шаг 2 — резолвируемость ICU через `isResolvableTimeZone` (из `@packages/utils`).
- **Запрет whitelist.** `Intl.supportedValuesOf("timeZone")` **не** использовать как allowlist при валидации. Допустимо использовать только в UI (необязательно). Основная валидация — двухшаговая.
- **Автодетект.** `Intl.DateTimeFormat().resolvedOptions().timeZone` — только для автоподстановки.

## 3. Компоненты и утилиты

| Файл | Тип | Описание |
|---|---|---|
| `entities/user/lib/timezones.ts` | NEW | Статический список популярных IANA-таймзон с группировкой по регионам (Europe/Asia/America/Africa/Oceania/UTC и др.). Экспорт: `POPULAR_TIMEZONES`, `getBrowserTimezone()`, `groupTimezones()` (или эквивалент). |
| `entities/user/ui/TimezoneSelect.tsx` | NEW | Селектор IANA-таймзон. Поиск по названию/зоне, группировка по регионам, кнопка `profile.detectTimezone` («Определить автоматически»). |

## 4. Правила

- `POPULAR_TIMEZONES` — компактный практичный набор (не исчерпывающий список всех зон). Цель — удобство UX (поиск позволяет выбрать любую резолвируемую зону).
- Компонент принимает строку `value` и `onValueChange(string)`, `disabled?`.
- Разделение таймзон: селектор используется в профиле (`user.timezone`). Для отображения времени используется `viewerTimezone`/`authorTimezone` согласно shared-правилам.

## 5. i18n

Ключи: `profile.timezone`, `profile.detectTimezone`, `profile.timezoneHelp`.

## 6. Тест-кейсы

- [ ] Автодетект подставляет зону браузера
- [ ] Поиск фильтрует по названию зоны
- [ ] Группировка по регионам отображается
- [ ] При выборе значение передаётся в `onValueChange`
- [ ] Работает в disabled-состоянии

## 7. Связи

- `@packages/utils/datetime` — `isIanaTimeZoneFormat`, `isResolvableTimeZone`
- `@packages/i18n` — тексты
