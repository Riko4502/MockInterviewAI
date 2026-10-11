# Спецификация: единые правила работы с датой/временем и i18n (ADR-002–ADR-005)

## 1. Цель

Сформулировать единые правила для фронтенда `apps/web` при реализации слотов доступности, бронирования и отображения времени. Правила обязательны ко всем компонентам, затронутым задачей.

## 2. Источники требований

- [ADR-002: Расписание собеседований, слоты доступности и таймзоны](../../../../docs/adr/ADR-002.md)
- [ADR-003: Доменные события и диспетчер уведомлений](../../../../docs/adr/ADR-003.md)
- [ADR-004: Транспорт доставки уведомлений](../../../../docs/adr/ADR-004.md)
- [ADR-005: Security-уведомления и аудит событий безопасности](../../../../docs/adr/ADR-005.md)
- [Задача: Frontend for slot scheduling, interview booking, and security (ADR-002…ADR-005)](../../../../docs/tasks/frontend%20for%20slot%20scheduling%2C%20interview%20booking%2C%20and%20security%20%28ADR-002%E2%80%A6ADR-005%29.md)

## 2.1. Предпосылки и общий тип (обязательно)

- **Backend [B].** `GET /profile/me` обязан возвращать `timezone`, а `PATCH /profile/me` — сохранять его. Сейчас `UserProfileDto`/`USER_PROFILE_SELECT` поле не содержат, `updateProfile` его игнорирует, а `mapToUserProfile` (`apps/api/src/modules/users/users.service.ts`) не прокидывает его в ответ (при этом запросная схема `updateProfileSchema` уже валидирует `timezone`). Модель Prisma `User.timezone` существует (`@default("Europe/Moscow")`) и читается витриной. Правки [B]: `USER_PROFILE_SELECT` (+`timezone`), response-схема `userProfileSchema`, `mapToUserProfile`, `updateProfile` data. Без доработки правило `viewerTimezone` (п. 3.2) невыполнимо. После доработки — регенерировать OpenAPI → Orval → `packages/api`.
- **Решение по `User.timezone` (обязательно, до [B]).** Колонка **не-nullable** с `@default("Europe/Moscow")`: у всех существующих и новых пользователей поле уже заполнено, поэтому фоллбэк на браузерную зону (`user?.timezone || browserTz`) для авторизованных **никогда не сработает** — все будут видеть Moscow. Зафиксировать одно из: (а) оставить default и явно принять, что зона по умолчанию — Moscow; (б) сделать колонку nullable и полагаться на браузерный фоллбэк до явной установки; (в) автоопределять зону клиентом при онбординге/первом входе и сохранять её. От этого зависит тип в `userProfileSchema`: `z.string()` (required) vs `z.string().nullable()`. Не оставлять «фоллбэк на браузер» в спеке как основной механизм без этого решения.
- **Общий тип `AvailabilitySlot`.** В `@packages/api` генерируются контекстные типы (`PaginatedShowcaseCardsDtoDataItemSlotsItem`, `MatchRequestResponseDtoSlot`, `CreateShowcaseCardDtoSlotsItem`), но нет общего `AvailabilitySlot`. Запрещено создавать локальные дублирующие интерфейсы (п. 5). До начала работ определить общий тип (например, в `@packages/types` или как явный экспорт-алиас) либо зафиксировать конкретные generated-типы в каждом плане.
- **`ConfirmDialog`.** В `@packages/ui` его нет (есть только базовый `Dialog`). Решить заранее: создать общий `ConfirmDialog` в `packages/ui` или использовать app-local паттерн (как `DeleteCardConfirmDialog`).

## 3. Правила работы с датой и временем

### 3.1. Единый фасад для работы с датой
- **Только через фасад.** Все операции со временем в `apps/web/src/**` выполняются исключительно через `@packages/utils` (корневой баррeль). Подпуть `@packages/utils/datetime` в репозитории **отсутствует**: `packages/utils/package.json` маппит `./*` → `./src/*.ts`, но `src/datetime/` — это каталог без `index.ts`. Импортировать из `@packages/utils`.
- **Строгий запрет.** Прямые импорты следующих библиотек в `apps/web/src/**` запрещены: `date-fns`, `@date-fns/tz`, `dayjs`, `luxon`, `date-fns-tz`, `moment`.
- **Рекомендуемые экспорты.** `formatInstantInTimeZone`, `isIanaTimeZoneFormat`, `isResolvableTimeZone`, `resolveLocalTimeToUtc`, `utcToLocalDateTime`, `slotEndsAt`, `slotsOverlap`. При необходимости использовать дополнительные утилиты из того же фасада, не дублируя логику.
- **Локаль форматирования.** `formatInstantInTimeZone(instant, timeZone, pattern)` вызывает date-fns `format` **без параметра locale** (дефолт `en-US`). Паттерны `'d MMMM yyyy'`/`'EEE'` дадут английские названия месяцев/дней даже в RU-локали. До начала работ решить: либо расширить сигнатуру утилиты (`locale?`, прокидывается из i18n), либо не использовать текстовые токены месяцев/дней. Это касается всех мест рендера времени.

### 3.2. Разделение таймзон

- **`viewerTimezone` (таймзона смотрящего).** Таймзона текущего авторизованного пользователя (читателя). Используется **во всех** местах отображения времени другим пользователям/для текущего пользователя: витрина карточек (`ShowcaseCard`), центр заявок (`IncomingRequestCard`, `OutgoingRequestCard`), баннер запланированного интервью (`MatchedSessionBanner`), дашборд (`DashboardUpcomingSession`, `DashboardRecentSessions`), колокольчик уведомлений (`NotificationItem`).
- **`authorTimezone` (таймзона автора карточки).** Таймзона автора при создании/редактировании **собственной** анкеты. Используется **только** для конвертации `startsAt` (UTC) → `startsAtLocal` (`YYYY-MM-DDTHH:mm`) при инициализации формы редактирования (`EditCardView`) и для подсказки UI «Время указывается в вашей таймзоне (...)» в конструкторе слотов.
- **Источник `viewerTimezone`.** Единый хук `useViewerTimezone()` из [1] `entities/user` (внутри: профиль `useCurrentUser()` → `user?.timezone` → зона браузера → `"UTC"`). Требует backend-предпосылки [B] (п. 2.1). Потребители [2], [4], [5], [7], [8] используют хук, инлайн-фоллбэк не дублируют. Для неавторизованного зрителя (публичный каталог) профиль недоступен — берётся браузерная зона; это ожидаемое поведение. На публичных страницах запрашивать профиль только при авторизации (`enabled` у хука), чтобы не получать 401.
- **Формат отображения.** UTC-инстант (`startsAt`) никогда не показывается «как есть» другому пользователю. Форматирование только через `formatInstantInTimeZone(instant, viewerTimezone, format)`.
- **Формат формы.** `startsAtLocal` — строго `YYYY-MM-DDTHH:mm`. Конвертация при редактировании: `formatInstantInTimeZone(slot.startsAt, userTimezone, "yyyy-MM-dd'T'HH:mm")`.

### 3.3. IANA-валидация таймзоны

- **Двухшаговая валидация.** Шаг 1 — проверка формата по regex через `isIanaTimeZoneFormat`. Шаг 2 — проверка резолвируемости ICU через `isResolvableTimeZone`. Обе утилиты — из `@packages/utils`.
- **Запрет whitelist.** `Intl.supportedValuesOf("timeZone")` **не** используется в качестве allowlist при валидации (ADR-002:21,51). Его можно использовать **только** в UI (поиск/группировка), но не для принятия решения «валидна ли зона».
- **Кнопка автодетекта.** `Intl.DateTimeFormat().resolvedOptions().timeZone` используется только для автоподстановки в `TimezoneSelect`.

### 3.4. Защита от несуществующего локального времени (DST)

- **Клиентская проверка «не в прошлом».** Для `slotItemSchema.startsAtLocal` резолвить локальное время в UTC через `resolveLocalTimeToUtc(startsAtLocal, authorTimezone)`. Функция возвращает `{ ok: true, utc: Date }` либо `{ ok: false, reason: "malformed" | "nonexistent" }`. Валидно, если `res.ok && res.utc > new Date()`; при `reason === "nonexistent"` (несуществующее локальное время из-за DST) — невалидно, блокировать. Та же семантика, что у сервера. Не сравнивать наивные строки/`Date`.
- **Серверная проверка — основная.** Сервер применяет round-trip (`resolveSlot`) и при несуществующем локальном времени в зоне автора возвращает `422 Unprocessable Entity`. Фронт должен корректно отобразить это сообщение при ответе API.
- **Избегать неявных сдвигов.** Не использовать наивные парсинги, способные «молча» сдвинуть 02:00→03:00. Работать строго через фасад `@packages/utils` (`resolveLocalTimeToUtc`, `utcToLocalDateTime`).

## 4. Правила i18n

- **Namespace `showcase`.** Все тексты, относящиеся к слотам, выносятся в `packages/i18n/src/locales/{ru,en}/showcase.json`.
- **Ключи.** Блок `slots.*`: `title`, `addSlot`, `addSlotDisabledMax`, `selectSlotRequired`, `slotConflict`, `durationMinutes`, `noSlots`, `booked`, `upcomingSlots`, `moreCount`, `cannotDeleteBooked`, `cannotAddInPast`, `timeInYourTimezone`, `duration`, `date`, `startTime`, `chooseSlot`, `freeCount`, `bookedCount`.
- **Плюрализация `count`.** Ключи `durationMinutes`, `moreCount`, `freeCount`, `bookedCount` вызываются с `count`. В текущих локалях плюральных суффиксов (`_one`/`_few`/`_many`) нет — i18next сойдёт на базовый ключ. Если нужны формы, добавить суффиксы; иначе не полагаться на автоматическую плюрализацию.
- **Блок `profile.*`:** `timezone`, `detectTimezone`, `timezoneHelp`.
- **Типобезопасность.** Обновить типы i18n в `packages/i18n` так, чтобы `useTranslation('showcase')` был типобезопасным. Проверить экспорт в `packages/i18n/src/index.ts`.
- **Без хардкода.** В новых/правленых компонентах не использовать захардкоженные русские/английские строки. Только ключи из `showcase` (и при необходимости `common`).

## 5. Типобезопасность и контракты API

- **Единственный источник типов.** `slots`, `slotId`, `startsAt`, `durationMinutes`, `status`, `bookedByRequestId`, типы `ShowcaseCard`, `MatchRequest`, `User` берутся из `@packages/api` и/или `@packages/dto`. Общий тип `AvailabilitySlot` определяется один раз (п. 2.1). Локальные дублирующие интерфейсы **не** создавать.
- **Маппинг формы.** UI→DTO строго по контракту. **BOOKED-слоты исключаются из полезной нагрузки** (`replaceSlots` на сервере передаёт занятые слоты как `existing`, поэтому BOOKED-слот в `slots` вызовет пересечение с самим собой и `409 Conflict`). Фильтровать перед маппингом:
  ```ts
  slots: values.slots && values.slots.some(s => !s.booked)
    ? values.slots
        .filter(s => !s.booked)
        .map(s => ({ startsAtLocal: s.startsAtLocal, durationMinutes: s.durationMinutes }))
    : undefined
  ```
  Если в форме остаются только BOOKED-слоты, `slots` не передаётся (`undefined`) — занятые слоты сохраняются сервером без изменений.
- **UTC vs local.** Никогда не передавать `startsAt` с клиента при создании/обновлении карточки. Только `startsAtLocal` + `durationMinutes`.
- **Опциональность `slotId`.** Передавать `slotId` в `createMatchRequest` **только** если он действительно выбран. Если у карточки **нет** открытых слотов — `slotId` не передавать (`undefined`).

## 6. Бизнес-правила (клиентский минимум)

- **Обязательность выбора слота.** Если у целевой карточки есть >=1 открытый слот (`status==='OPEN'` и `startsAt > now()`) — выбор `slotId` обязателен. Кнопка отправки отклика блокируется до выбора.
- **Гонка 409.** При ответе `409 Conflict` на создание заявки: показать Toast `slots.slotConflict`, `queryClient.invalidateQueries` по целевой карточке, **сбросить** выбранный `slotId`, **не закрывать** диалог.
- **Устаревшие данные 400.** Если клиент шлёт отклик без `slotId`, а у карточки уже есть OPEN-слот, бэкенд отвечает `400`. Обрабатывать так же: `invalidateQueries` карточки + сброс `slotId` (диалог не закрывать), чтобы подтянуть актуальные слоты.
- **1–10 слотов.** Максимум 10 отправляемых слотов на карточку. Кнопка «Добавить слот» дизейблится при достижении лимита по не-BOOKED слотам (сервер считает `kept + created` без BOOKED). Не применять `max(10)` к массиву, включающему BOOKED.
- **Слот не в прошлом.** Клиентская валидация по локальному времени в `authorTimezone`.
- **BOOKED нельзя удалить.** В форме редактирования `BOOKED`-слот отображается с бейджем `slots.booked`, кнопка удаления дизейблится.
- **Фильтрация в витрине/диалоге.** Показывать только `status==='OPEN'` и `startsAt > now()`. Сортировать по возрастанию `startsAt`.
- **Лимит показа.** В витрине — максимум 3 ближайших OPEN-слота, при большем количестве показывать `+N ещё`.
- **Счётчики моих анкет.** `freeCount = count of status==='OPEN' && startsAt > now()` (прошедшие OPEN не считаются свободными — они небронируемы), `bookedCount = count of status==='BOOKED'` (все).

## 7. Проверочные правила при разработке

- [ ] **Типизация.** `pnpm --filter web exec tsc --noEmit` — без ошибок.
- [ ] **Запрет прямых импортов дат.** `grep -R --include="*.ts" --include="*.tsx" -E "(from ['\"](date-fns|@date-fns/tz|dayjs|luxon|date-fns-tz|moment)['\"])" apps/web/src` — пустой результат.
- [ ] **Единообразие форматирования.** Весь показ времени в UI использует `formatInstantInTimeZone` с корректным `viewerTimezone`/`authorTimezone`.
- [ ] **Единый резолвер таймзоны.** `viewerTimezone` берётся из `useViewerTimezone()` (план [1]); инлайн-фоллбэк `user?.timezone || Intl...` не дублируется.
- [ ] **i18n.** Новые тексты только через `useTranslation('showcase')`.
- [ ] **Типы из пакетов.** `slots`/`slotId` типизированы через `@packages/api`/`@packages/dto`.
- [ ] **Тесты.** `pnpm --filter web exec vitest run` — успешно. Все тесты, зависящие от `now()` (фильтрация OPEN+future, «не в прошлом»), фиксируют часы через `vi.useFakeTimers()`/`setSystemTime` и сбрасывают их после (`vi.useRealTimers()`), иначе флейки по мере наступления дат.

## 8. Связанные файлы

- `apps/web/src/entities/user/model/use-viewer-timezone.ts` — единый резолвер `viewerTimezone`
- `apps/web/src/entities/user/ui/TimezoneSelect.tsx` — селектор IANA
- `apps/web/src/entities/showcase-card/ui/ShowcaseSlotBadge.tsx`, `ShowcaseSlotsList.tsx`, `lib/format-card-slot.ts`
- `apps/web/src/features/manage-showcase-card/*` — конструктор слотов
- `apps/web/src/features/send-match-request/*` — выбор слота при отклике + 409
- `apps/web/src/widgets/match-requests-hub/*` — отображение `req.slot`
- `apps/web/src/widgets/dashboard/*` — синхронизация таймзоны
- `apps/web/src/entities/notification/ui/NotificationItem.tsx` — рендер времени в уведомлениях
- `apps/web/src/features/update-profile/*` — таймзона + безопасная отвязка
- `packages/i18n/src/locales/{ru,en}/showcase.json` — тексты
