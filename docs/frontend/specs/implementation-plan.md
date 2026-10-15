# Общий план реализации: слоты, бронирование интервью и безопасность (ADR-002…ADR-005)

## 1. Назначение документа

Этот файл — **индексный** план: он задаёт единственный **порядок выполнения** и зависимости для всех нижележащих спецификаций и планов из `docs/frontend/specs/`. Детальные чеклисты (файлы, тест-кейсы, критерии приёмки) живут в соответствующих `*-spec.md` / `*-plan.md`; здесь они **не дублируются**, чтобы не расходиться с ними.

Каждая пара `*-spec.md` (что делаем) и `*-plan.md` (как делаем) покрывает отдельный микродомен FSD: сущность, фичу или виджет.

> **Источник истины.** Для сквозных правил — `shared/datetime-and-i18n-rules-spec.md`; для деталей — соответствующий `*-plan.md`. При расхождении приоритет у под-плана и спецификации, а этот документ надо поправить.

## 2. Перечень нижележащих планов и статус

| # | План | Слой | Приоритет | Статус |
|---|---|---|---|---|
| B | backend: `User.timezone` в профиле | `apps/api` | Предусловие | ✅ Готово |
| 0 | [shared/datetime-and-i18n-rules-plan.md](./shared/datetime-and-i18n-rules-plan.md) | shared | База | ✅ Готово |
| 1 | [entities/user/timezone-plan.md](./entities/user/timezone-plan.md) | entities/user | P1 | ✅ Готово |
| 2 | [entities/showcase-card/availability-slots-plan.md](./entities/showcase-card/availability-slots-plan.md) | entities/showcase-card | P1 | ✅ Готово |
| 3 | [features/manage-showcase-card/slot-picker-plan.md](./features/manage-showcase-card/slot-picker-plan.md) | features | P1 | ✅ Готово |
| 4 | [features/send-match-request/slot-selection-plan.md](./features/send-match-request/slot-selection-plan.md) | features | P0 | ✅ Готово |
| 5 | [widgets/match-requests-hub/assigned-slot-display-plan.md](./widgets/match-requests-hub/assigned-slot-display-plan.md) | widgets | P1 | ✅ Готово |
| 6 | [widgets/my-cards-list/slot-stats-plan.md](./widgets/my-cards-list/slot-stats-plan.md) | widgets | P1 | ⏳ Не начато |
| 7 | [widgets/dashboard/timezone-sync-plan.md](./widgets/dashboard/timezone-sync-plan.md) | widgets | P2 | ⏳ Не начато |
| 8 | [entities/notification/notification-slot-time-plan.md](./entities/notification/notification-slot-time-plan.md) | entities/notification | P2 | ⏳ Не начато |
| 9 | [features/update-profile/timezone-and-security-plan.md](./features/update-profile/timezone-and-security-plan.md) | features | P2/P3 | ⏳ Не начато |

Статусы выше — срез по текущему состоянию репозитория. Актуализировать по мере закрытия фаз.

### 2.1. Закрытые предусловия и принятые решения

Зафиксированы **до** начала Фазы A и уже реализованы:

- **[B] backend `User.timezone` (✅ готово).** `timezone` добавлен в `USER_PROFILE_SELECT`, сохраняется в `UsersService.updateProfile`, прокидывается в ответ `UsersService.mapToUserProfile`; response-схема `userProfileSchema` (`packages/dto/src/profile/user-profile.dto.ts`) содержит `timezone: z.string()`; `register`/`login` DTO принимают `timezone`. OpenAPI → Orval → `packages/api` регенерированы (`userProfileDto.timezone: string`, `createMatchRequestDto.slotId?: string`). Запросная схема `updateProfileSchema` валидирует `timezone` (как и раньше).
- **Решение по `User.timezone` (✅ принято).** Автоопределение: браузерная IANA-зона отправляется при `login`/`register` и сохраняется один раз на первом входе. Тип `userProfileSchema.timezone` — `z.string()` (required). Колонка non-nullable с `@default("Europe/Moscow")`.
- **Решение по локали (`formatInstantInTimeZone`) (✅ принято).** Сигнатура расширена параметром `locale` (`"ru"` / `"en"`, дефолт `"en"`, неизвестная → `en`) в `packages/utils/src/datetime/format.ts`.
- **Общий тип `AvailabilitySlot` (✅ определён).** `packages/types/src/slot.ts`; локальные дублирующие интерфейсы запрещены.
- **`ConfirmDialog` (✅ решение принято, реализация — в [9]).** Создаётся **общий** `ConfirmDialog` в `@packages/ui` (переиспользуемый: заголовок/описание/кнопки/loading), а не app-local паттерн `DeleteCardConfirmDialog`.
- **Подсказка «гибкое расписание» (✅ решение принято, реализовано в [4]).** При отсутствии OPEN-слотов `SendMatchRequestDialog` показывает подсказку `slots.flexibleSchedule` (ключ добавлен в RU/EN `showcase.json`) и не передаёт `slotId`. Это осознанное дополнение к `slot-selection-spec.md` (task, Задача 1).

## 3. Граф зависимостей

```text
[B] backend: expose & persist User.timezone        (✅ готово, apps/api)
        │
        v
[0] shared/datetime-and-i18n-rules                 (✅ базовые правила, обязательны для всех)
        │
        ├────────────────────────────────────────────┐
        v                                            v
[1] entities/user/timezone (✅)                 [6] widgets/my-cards-list/slot-stats
  useViewerTimezone + TimezoneSelect               (зависит только от [0]:
   + lib/timezones                                  счётчики без форматирования времени)
        │
        ├──> [2] entities/showcase-card/availability-slots   (✅)
        │            │
        │            ├──> [3] features/manage-showcase-card/slot-picker  (✅)
        │            └──> [5] widgets/match-requests-hub/assigned-slot-display (✅)
        │
        ├──> [4] features/send-match-request/slot-selection   (✅ P0, критический путь)
        ├──> [7] widgets/dashboard/timezone-sync
        ├──> [8] entities/notification/notification-slot-time
        └──> [9] features/update-profile/timezone-and-security
```

Пояснения зависимостей:

- **[B] backend** — закрыт (см. §2.1). Больше не блокирует Фазу A.
- **[0] shared** — фундамент: правила фасада `@packages/utils` (корневой баррeль; подпуть `@packages/utils/datetime` в репозитории **отсутствует**), запрет прямых импортов дат, разделение `viewerTimezone`/`authorTimezone`, двухшаговая IANA-валидация, i18n namespace `showcase`, общий тип `AvailabilitySlot`. Ни один другой план не начинается до усвоения этих правил.
- **[1] timezone** — создаёт `useViewerTimezone()` (единый резолвер таймзоны смотрящего), `TimezoneSelect`, `lib/timezones.ts`. Базовая зависимость: [2], [4], [5], [7], [8] берут `viewerTimezone` из `useViewerTimezone()`; [3] и [9] — `TimezoneSelect`/`lib/timezones`.
- **[2] showcase-card slots** — создаёт `ShowcaseSlotBadge`/`ShowcaseSlotsList` (использует `useViewerTimezone()` из [1]), переиспользуемые в [3] и [5].
- **[3] slot-picker** — конструктор слотов автора; зависит от [1] (`TimezoneSelect`/`lib/timezones`, таймзона автора) и [2] (компоненты показа).
- **[4] slot-selection (P0)** — критический путь: обязательный выбор слота + обработка `409`/`400`. Зависит от [0] и [1] (`viewerTimezone` через `useViewerTimezone()`); `SlotSelectorRadioGroup` самостоятелен и **не** переиспользует компоненты [2], поэтому [4] не блокируется [2].
- **[6] slot-stats** — зависит **только** от [0]: считает `OPEN`+future / `BOOKED` без форматирования времени, `viewerTimezone` не нужен.
- **[5], [7], [8], [9]** — потребители готовых компонентов/правил, независимы между собой (можно параллелить).

## 4. Порядок выполнения

> Номера шагов ниже — это **порядок исполнения**, а не ID планов из §2. Соответствие шаг→ID: `1→[0]`, `2→[1]`, `3→[4]`, `4→[2]`, `5→[3]`, `6→[5]`, `7→[6]`, `8→[7]`, `9→[8]`, `10→[9]`.

### Фаза 0. Backend-предусловия (✅ закрыто)

0. **[B] backend: `User.timezone` в профиле** — ✅ выполнено. `timezone` в `USER_PROFILE_SELECT`, в response-схеме `userProfileSchema`, в `mapToUserProfile`, сохраняется в `updateProfile`; OpenAPI → Orval → `packages/api` регенерированы. Подробности — §2.1.

### Фаза A. База (обязательно первая) — ✅ закрыто

1. **[0] shared/datetime-and-i18n-rules** — ✅ правила изучены и зафиксированы; i18n namespace `showcase` создан; общий тип `AvailabilitySlot` определён в `@packages/types`; локаль `formatInstantInTimeZone` расширена.
2. **[1] entities/user/timezone** — ✅ `useViewerTimezone()`, `TimezoneSelect`, `lib/timezones` + справочник.

### Фаза B. Критический путь (P0) — ✅ закрыто

3. **[4] features/send-match-request/slot-selection** — ✅ `SlotSelectorRadioGroup` (фильтр OPEN+future, сортировка asc, `viewerTimezone`), `SendMatchRequestDialog` передаёт `slotId`, обязательный выбор при наличии OPEN-слотов, обработка `409`/`400` (toast + `invalidateQueries` + сброс выбора, диалог не закрывается), подсказка `slots.flexibleSchedule` при отсутствии слотов. Использует `useViewerTimezone()` из [1]. Не зависит от [2].

### Фаза C. Основа слотов (P1) — ✅ закрыто

4. **[2] entities/showcase-card/availability-slots** — ✅ компоненты показа слотов в витрине (использует `useViewerTimezone()`).
5. **[3] features/manage-showcase-card/slot-picker** — ✅ конструктор слотов в форме анкеты.

### Фаза D. Отображение (P1) — ⏳

6. **[5] widgets/match-requests-hub/assigned-slot-display** — ✅ слот в заявках (`RequestSlotInfo`) + баннер запланированного интервью.
7. **[6] widgets/my-cards-list/slot-stats** — счётчики слотов в «Моих анкетах».

### Фаза E. Таймзона и уведомления (P2) — ⏳

8. **[7] widgets/dashboard/timezone-sync** — замена `useState("UTC")` на `useViewerTimezone()`.
9. **[8] entities/notification/notification-slot-time** — рендер времени слота в уведомлениях.

### Фаза F. Безопасность (P2/P3) — ⏳

10. **[9] features/update-profile/timezone-and-security** — таймзона в профиле + подтверждающие диалоги отвязки (ADR-005).

## 5. Параллелизация

После Фазы A ([0] + [1]) — все зависимости от [1] закрыты, поэтому:

- **[4]** (P0) и **[6]** можно начинать сразу: [4] не зависит от [2]/[3], [6] — только от [0].
- **[7]**, **[8]**, **[9]** зависят только от [1] — можно параллелить.
- После [2] (уже готов) доступен **[5]** ([3] уже готов).

## 6. Контрольные точки (Gate)

| Gate | Условие перехода | Проверка | Статус |
|---|---|---|---|
| Start → G1 | Backend [B] готов; решения зафиксированы | `GET /profile/me` возвращает `timezone`; `PATCH` сохраняет; `packages/api` регенерирован; решения по `User.timezone` (autodetect) и по локали `formatInstantInTimeZone` (`locale`) приняты | ✅ |
| G1 → G2 | Правила [0] + база [1] готовы | i18n `showcase`, тип `AvailabilitySlot` (`@packages/types`), `useViewerTimezone()`/`TimezoneSelect`; `useTranslation('showcase')` типобезопасен | ✅ |
| G2 → G3 | [4] завершён | `SendMatchRequestDialog` передаёт `slotId`, `409`/`400` обработаны; unit-тесты проходят | ✅ |
| G3 → G4 | [2], [3] завершены | Форма сохраняет 1–10 слотов (без BOOKED), витрина показывает слоты в `viewerTimezone` | ✅ |
| G4 → G5 | [5], [6] завершены | Заявки показывают `req.slot`, «Мои анкеты» — счётчики | ⏳ |
| G5 → Done | [7], [8], [9] завершены + финальные проверки | DoD раздела 7 | ⏳ |

## 7. Определение готовности (DoD)

Здесь только **сквозные** критерии, общие для нескольких планов. Детальные (файлы, тест-кейсы конкретного компонента) — в соответствующем под-плане; этот раздел не заменяет его чеклист.

**Backend / контракты**
- [x] Backend: `GET /profile/me` возвращает `timezone`, `PATCH /profile/me` сохраняет его; OpenAPI/Orval/`packages/api` регенерированы.
- [x] Решение по `User.timezone` зафиксировано — **autodetect** (браузерная зона при `login`/`register`), `userProfileSchema.timezone` — `z.string()` required.
- [x] Поля `slots`/`slotId` типизированы через `@packages/api`/`@packages/dto` (в т.ч. `createMatchRequestDto.slotId`).
- [x] Общий тип `AvailabilitySlot` определён в `@packages/types` и используется (локальных дублей нет).
- [x] Актуализирован `docs/frontend/data/api-contracts.md` — добавлена секция «Слоты и таймзоны (ADR-002)» с полями профиля/заявок (`timezone`, `slotId`, `slots`) и правилами рендера времени.

**Датирование / i18n / типобезопасность**
- [x] Все импорты времени — из `@packages/utils` (не `@packages/utils/datetime`); прямые импорты `date-fns`, `@date-fns/tz`, `dayjs`, `luxon`, `date-fns-tz`, `moment` в `apps/web/src/**` отсутствуют.
- [x] Локаль решена: `formatInstantInTimeZone` принимает `locale` (`"ru"`/`"en"`); текстовые токены используются с явной локалью.
- [x] i18n-ключи `slots.*`/`profile.*` добавлены в RU/EN `showcase.json`, типы обновлены.
- [x] Typecheck автоматизирован: задача `typecheck` в `turbo.json` (`dependsOn: ["^build"]`) и корневой скрипт `pnpm typecheck`; `pnpm --filter web typecheck` (`tsc --noEmit`) — 0 ошибок (весь фронт).
- [x] Сквозной typecheck затронутых workspace-пакетов (`packages/utils`, `packages/i18n`, `packages/api`, `packages/types`, `packages/ui`) — без деградаций.

**Поведение**
- [x] `SendMatchRequestDialog`: обязателен выбор слота при наличии OPEN-слотов; `slotId` передаётся; `409` обработан (toast + `invalidateQueries` + сброс выбора); `400` показывает фактическое сообщение сервера (а не «Выберите слот»); при отсутствии слотов — подсказка про гибкое расписание (см. task, Задача 1), `slotId` не передаётся.
- [x] `ShowcaseCardForm`: 1–10 слотов (без BOOKED); запрет слота в прошлом; BOOKED нельзя удалить; слоты в live-preview; ответ API `422` (несуществующее локальное время, DST) показан пользователю.
- [x] BOOKED-слоты **исключаются** из полезной нагрузки `slots` при создании/обновлении (иначе `replaceSlots` даёт `409`); в форме BOOKED отображаются только для чтения.
- [x] `viewerTimezone` резолвится единым `useViewerTimezone()` (без инлайн-дублей фоллбэка) в [2] (готово).
- [x] `viewerTimezone` из `useViewerTimezone()` применяется в [4] (✅ готово), [5] (✅ готово).
- [ ] `viewerTimezone` из `useViewerTimezone()` применяется в [7], [8].
- [x] Каталог отображает слоты в таймзоне смотрящего.
- [x] Заявки отображают `req.slot` в таймзоне смотрящего (плашка+статус в `IncomingRequestCard`/`OutgoingRequestCard`, баннер запланированного интервью в `MatchedSessionBanner`).
- [ ] Профиль: выбор и сохранение IANA-таймзоны; автодетект; дашборд использует профильную таймзону.
- [ ] Уведомления рендерят `payload.slotStartsAt` в таймзоне пользователя.
- [ ] Отвязка Telegram/GitHub требует подтверждения с предупреждением о ревокации сессий; подтверждающий диалог реализован (общий `ConfirmDialog` в `@packages/ui` **или** зафиксирован app-local паттерн).
- [x] **Публичные страницы** не запрашивают профиль у неавторизованного зрителя. Проверено: все потребители `useViewerTimezone()`/`useCurrentUser()` (в т.ч. каталожный `ShowcaseCard`, `ShowcaseFeed`, Sidebar/`NavUser`) находятся под `AuthBoundary mode="protected"` (роуты `(protected)/dashboard/**`, `(protected)/profile/**`, `(protected)/admin/**`), а `AuthBoundary` не рендерит `children` без авторизации; на guest-роутах потребителей нет. Лишний запрос профиля → `401` для неавторизованного зрителя сейчас не возникает. Если каталог `ShowcaseCard` станет публичным — передавать `useViewerTimezone({ enabled: isAuthenticated })` (см. `shared/datetime-and-i18n-rules-spec.md`).

**Тесты**
- [ ] Unit-тесты: `SendMatchRequestDialog`, `ShowcaseCardForm`, `ShowcaseSlotsList`, `TimezoneSelect`, `IncomingRequestCard`, `OutgoingRequestCard`, `MatchedSessionBanner`, `MyCardItem`, `NotificationItem`, `ConnectedAccountsSection`.
- [ ] `pnpm --filter web exec vitest run` — успешно. Тесты, зависящие от `now()`, фиксируют часы (`vi.useFakeTimers()`/`setSystemTime` + сброс).

## 8. Связанные документы

- [Задача: Frontend for slot scheduling, interview booking, and security (ADR-002…ADR-005)](../../tasks/frontend%20for%20slot%20scheduling%2C%20interview%20booking%2C%20and%20security%20%28ADR-002%E2%80%A6ADR-005%29.md)
- [ADR-002: Расписание собеседований, слоты доступности и таймзоны](../../adr/ADR-002.md)
- [ADR-003: Доменные события и диспетчер уведомлений](../../adr/ADR-003.md)
- [ADR-004: Транспорт доставки уведомлений](../../adr/ADR-004.md)
- [ADR-005: Security-уведомления и аудит событий безопасности](../../adr/ADR-005.md)
