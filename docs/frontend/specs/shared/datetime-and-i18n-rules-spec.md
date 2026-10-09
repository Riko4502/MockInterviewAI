# Спецификация: единые правила работы с датой/временем и i18n (ADR-002–ADR-005)

## 1. Цель

Сформулировать единые правила для фронтенда `apps/web` при реализации слотов доступности, бронирования и отображения времени. Правила обязательны ко всем компонентам, затронутым задачей.

## 2. Источники требований

- [ADR-002: Расписание собеседований, слоты доступности и таймзоны](../../../../docs/adr/ADR-002.md)
- [ADR-003: Доменные события и диспетчер уведомлений](../../../../docs/adr/ADR-003.md)
- [ADR-004: Транспорт доставки уведомлений](../../../../docs/adr/ADR-004.md)
- [ADR-005: Security-уведомления и аудит событий безопасности](../../../../docs/adr/ADR-005.md)
- [Задача: Frontend for slot scheduling, interview booking, and security (ADR-002…ADR-005)](../../../../docs/tasks/Frontend%20for%20slot%20scheduling%2C%20interview%20booking%2C%20and%20security%20%28ADR-002%E2%80%A6ADR-005%29.md)

## 3. Правила работы с датой и временем

### 3.1. Единый фасад для работы с датой

- **Только через фасад.** Все операции со временем в `apps/web/src/**` выполняются исключительно через `@packages/utils/datetime`.
- **Строгий запрет.** Прямые импорты следующих библиотек в `apps/web/src/**` запрещены: `date-fns`, `@date-fns/tz`, `dayjs`, `luxon`, `date-fns-tz`, `moment`.
- **Рекомендуемые экспорты.** `formatInstantInTimeZone`, `isIanaTimeZoneFormat`, `isResolvableTimeZone`. При необходимости использовать дополнительные утилиты из того же фасада, не дублируя логику.

### 3.2. Разделение таймзон

- **`viewerTimezone` (таймзона смотрящего).** Таймзона текущего авторизованного пользователя (читателя). Используется **во всех** местах отображения времени другим пользователям/для текущего пользователя: витрина карточек (`ShowcaseCard`), центр заявок (`IncomingRequestCard`, `OutgoingRequestCard`), баннер запланированного интервью (`MatchedSessionBanner`), дашборд (`DashboardUpcomingSession`, `DashboardRecentSessions`), колокольчик уведомлений (`NotificationItem`).
- **`authorTimezone` (таймзона автора карточки).** Таймзона автора при создании/редактировании **собственной** анкеты. Используется **только** для конвертации `startsAt` (UTC) → `startsAtLocal` (`YYYY-MM-DDTHH:mm`) при инициализации формы редактирования (`EditCardView`) и для подсказки UI «Время указывается в вашей таймзоне (...)» в конструкторе слотов.
- **Источник `viewerTimezone`.** Всегда профиль текущего пользователя `useCurrentUser()` с фоллбэками: `user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"`.
- **Формат отображения.** UTC-инстант (`startsAt`) никогда не показывается «как есть» другому пользователю. Форматирование только через `formatInstantInTimeZone(instant, viewerTimezone, format)`.
- **Формат формы.** `startsAtLocal` — строго `YYYY-MM-DDTHH:mm`. Конвертация при редактировании: `formatInstantInTimeZone(slot.startsAt, userTimezone, "yyyy-MM-dd'T'HH:mm")`.

### 3.3. IANA-валидация таймзоны

- **Двухшаговая валидация.** Шаг 1 — проверка формата по regex через `isIanaTimeZoneFormat`. Шаг 2 — проверка резолвируемости ICU через `isResolvableTimeZone`. Обе утилиты — из `@packages/utils`.
- **Запрет whitelist.** `Intl.supportedValuesOf("timeZone")` **не** используется в качестве allowlist при валидации (ADR-002:21,51). Его можно использовать **только** в UI (поиск/группировка), но не для принятия решения «валидна ли зона».
- **Кнопка автодетекта.** `Intl.DateTimeFormat().resolvedOptions().timeZone` используется только для автоподстановки в `TimezoneSelect`.

### 3.4. Защита от несуществующего локального времени (DST)

- **Клиентская проверка «не в прошлом».** Для `slotItemSchema.startsAtLocal` выполнять сравнение с текущим моментом **в таймзоне автора** (`user.timezone`) через утилиты фасада. Блокировать добавление слота при нарушении.
- **Серверная проверка — основная.** Сервер применяет round-trip (`resolveSlot`) и при несуществующем локальном времени в зоне автора возвращает `422 Unprocessable Entity`. Фронт должен корректно отобразить это сообщение при ответе API.
- **Избегать неявных сдвигов.** Не использовать наивные парсинги, способные «молча» сдвинуть 02:00→03:00. Работать строго через фасад `@packages/utils/datetime`.

## 4. Правила i18n

- **Namespace `showcase`.** Все тексты, относящиеся к слотам, выносятся в `packages/i18n/src/locales/{ru,en}/showcase.json`.
- **Ключи.** Блок `slots.*`: `title`, `addSlot`, `addSlotDisabledMax`, `selectSlotRequired`, `slotConflict`, `durationMinutes`, `noSlots`, `booked`, `upcomingSlots`, `moreCount`, `cannotDeleteBooked`, `cannotAddInPast`, `timeInYourTimezone`, `duration`, `date`, `startTime`, `chooseSlot`, `freeCount`, `bookedCount`.
- **Блок `profile.*`:** `timezone`, `detectTimezone`, `timezoneHelp`.
- **Типобезопасность.** Обновить типы i18n в `packages/i18n` так, чтобы `useTranslation('showcase')` был типобезопасным. Проверить экспорт в `packages/i18n/src/index.ts`.
- **Без хардкода.** В новых/правленых компонентах не использовать захардкоженные русские/английские строки. Только ключи из `showcase` (и при необходимости `common`).

## 5. Типобезопасность и контракты API

- **Единственный источник типов.** `slots`, `slotId`, `startsAt`, `durationMinutes`, `status`, `bookedByRequestId`, типы `ShowcaseCard`, `MatchRequest`, `User`, `AvailabilitySlot` берутся из `@packages/api` и/или `@packages/dto`. Локальные дублирующие интерфейсы **не** создавать.
- **Маппинг формы.** UI→DTO строго по контракту:
  ```ts
  slots: values.slots && values.slots.length > 0
    ? values.slots.map(s => ({ startsAtLocal: s.startsAtLocal, durationMinutes: s.durationMinutes }))
    : undefined
  ```
- **UTC vs local.** Никогда не передавать `startsAt` с клиента при создании/обновлении карточки. Только `startsAtLocal` + `durationMinutes`.
- **Опциональность `slotId`.** Передавать `slotId` в `createMatchRequest` **только** если он действительно выбран. Если у карточки **нет** открытых слотов — `slotId` не передавать (`undefined`).

## 6. Бизнес-правила (клиентский минимум)

- **Обязательность выбора слота.** Если у целевой карточки есть >=1 открытый слот (`status==='OPEN'` и `startsAt > now()`) — выбор `slotId` обязателен. Кнопка отправки отклика блокируется до выбора.
- **Гонка 409.** При ответе `409 Conflict` на создание заявки: показать Toast `slots.slotConflict`, `queryClient.invalidateQueries` по целевой карточке, **сбросить** выбранный `slotId`, **не закрывать** диалог.
- **1–10 слотов.** Максимум 10 слотов на карточку. Кнопка «Добавить слот» дизейблится при `fields.length >= 10`.
- **Слот не в прошлом.** Клиентская валидация по локальному времени в `authorTimezone`.
- **BOOKED нельзя удалить.** В форме редактирования `BOOKED`-слот отображается с бейджем `slots.booked`, кнопка удаления дизейблится.
- **Фильтрация в витрине/диалоге.** Показывать только `status==='OPEN'` и `startsAt > now()`. Сортировать по возрастанию `startsAt`.
- **Лимит показа.** В витрине — максимум 3 ближайших OPEN-слота, при большем количестве показывать `+N ещё`.
- **Счётчики моих анкет.** `freeCount = count of status==='OPEN'`, `bookedCount = count of status==='BOOKED'` по всем слотам карточки.

## 7. Проверочные правила при разработке

- [ ] **Типизация.** `pnpm --filter web exec tsc --noEmit` — без ошибок.
- [ ] **Запрет прямых импортов дат.** `grep -R --include="*.ts" --include="*.tsx" -E "(from ['\"](date-fns|@date-fns/tz|dayjs|luxon|date-fns-tz|moment)['\"])" apps/web/src` — пустой результат.
- [ ] **Единообразие форматирования.** Весь показ времени в UI использует `formatInstantInTimeZone` с корректным `viewerTimezone`/`authorTimezone`.
- [ ] **i18n.** Новые тексты только через `useTranslation('showcase')`.
- [ ] **Типы из пакетов.** `slots`/`slotId` типизированы через `@packages/api`/`@packages/dto`.
- [ ] **Тесты.** `pnpm --filter web exec vitest run` — успешно.

## 8. Связанные файлы

- `apps/web/src/entities/user/ui/TimezoneSelect.tsx` — селектор IANA
- `apps/web/src/entities/showcase-card/ui/ShowcaseSlotBadge.tsx`, `ShowcaseSlotsList.tsx`, `lib/format-card-slot.ts`
- `apps/web/src/features/manage-showcase-card/*` — конструктор слотов
- `apps/web/src/features/send-match-request/*` — выбор слота при отклике + 409
- `apps/web/src/widgets/match-requests-hub/*` — отображение `req.slot`
- `apps/web/src/widgets/dashboard/*` — синхронизация таймзоны
- `apps/web/src/entities/notification/ui/NotificationItem.tsx` — рендер времени в уведомлениях
- `apps/web/src/features/update-profile/*` — таймзона + безопасная отвязка
- `packages/i18n/src/locales/{ru,en}/showcase.json` — тексты
