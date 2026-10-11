# Общий план реализации: слоты, бронирование интервью и безопасность (ADR-002…ADR-005)

## 1. Назначение документа

Этот файл — корневой план, описывающий **порядок выполнения** всех нижележащих спецификаций и планов реализации из `docs/frontend/specs/`. Он связывает атомарные планы в единую последовательность и фиксирует зависимости между ними.

Каждая пара `*-spec.md` (что делаем) и `*-plan.md` (как делаем) покрывает отдельный микродомен FSD: сущность, фичу или виджет. Данный документ задаёт единственный порядок их исполнения.

## 2. Перечень нижележащих планов

| # | План | Слой | Приоритет |
|---|---|---|---|
| 0 | [shared/datetime-and-i18n-rules-plan.md](./shared/datetime-and-i18n-rules-plan.md) | shared | База |
| 1 | [entities/user/timezone-plan.md](./entities/user/timezone-plan.md) | entities/user | P2 |
| 2 | [entities/showcase-card/availability-slots-plan.md](./entities/showcase-card/availability-slots-plan.md) | entities/showcase-card | P1 |
| 3 | [features/manage-showcase-card/slot-picker-plan.md](./features/manage-showcase-card/slot-picker-plan.md) | features | P1 |
| 4 | [features/send-match-request/slot-selection-plan.md](./features/send-match-request/slot-selection-plan.md) | features | P0 |
| 5 | [widgets/match-requests-hub/assigned-slot-display-plan.md](./widgets/match-requests-hub/assigned-slot-display-plan.md) | widgets | P1 |
| 6 | [widgets/my-cards-list/slot-stats-plan.md](./widgets/my-cards-list/slot-stats-plan.md) | widgets | P1 |
| 7 | [widgets/dashboard/timezone-sync-plan.md](./widgets/dashboard/timezone-sync-plan.md) | widgets | P2 |
| 8 | [entities/notification/notification-slot-time-plan.md](./entities/notification/notification-slot-time-plan.md) | entities/notification | P2 |
| 9 | [features/update-profile/timezone-and-security-plan.md](./features/update-profile/timezone-and-security-plan.md) | features | P2/P3 |

> **Backend-предпосылка [B].** Помимо перечисленных frontend-планов, до начала работ требуется доработка бэкенда: `GET /profile/me` должен возвращать `timezone`, а `PATCH /profile/me` — его сохранять (см. §3, §4 Фаза 0). Без этого `viewerTimezone` и сохранение таймзоны в профиле не работают.

## 3. Граф зависимостей

```text
[B] backend: expose & persist User.timezone   (предпосылка, вне apps/web)
        │
        v
[0] shared/datetime-and-i18n-rules  (базовые правила, обязательны для всех)
        │
        ├──> [1] entities/user/timezone ─────────────┐
        │                                             │
        ├──> [2] entities/showcase-card/slots ───┐   │
        │                                        │   │
        │                                        v   v
        ├──> [3] features/manage-showcase-card/slot-picker
        │
        ├──> [4] features/send-match-request/slot-selection  (P0, критичный путь)
        │
        ├──> [5] widgets/match-requests-hub/assigned-slot-display
        ├──> [6] widgets/my-cards-list/slot-stats
        ├──> [7] widgets/dashboard/timezone-sync
        ├──> [8] entities/notification/notification-slot-time
        └──> [9] features/update-profile/timezone-and-security
```

Пояснения зависимостей:

- **[B] backend (предпосылка)** — бэкенд обязан возвращать `User.timezone` в `GET /profile/me` и сохранять его в `PATCH /profile/me`. Сейчас поле есть в модели Prisma (`User.timezone String @default("Europe/Moscow")`) и читается витриной, но `UserProfileDto`/`USER_PROFILE_SELECT` его не содержат, а `updateProfile` молча игнорирует `dto.timezone`. Без этой доработки `viewerTimezone` всегда падает в браузерный фоллбэк, а сохранение таймзоны в профиле фиктивно. Обязательна до Фазы A. **Важно:** колонка не-nullable с `@default("Europe/Moscow")`, поэтому после доработки у всех пользователей уже есть зона (Moscow) и браузерный фоллбэк не сработает — до [B] принять решение: оставить default / сделать nullable / автоопределять на онбординге (см. §2.1 shared-спецификации).
- **[0] shared** — фундамент: правила фасада `@packages/utils` (корневой баррeль; подпуть `@packages/utils/datetime` в репозитории **отсутствует**), запрет прямых импортов дат, разделение `viewerTimezone`/`authorTimezone`, двухшаговая IANA-валидация, i18n namespace `showcase`, общий тип `AvailabilitySlot`. Ни один другой план не начинается до усвоения этих правил.
- **[1] timezone** — создаёт `TimezoneSelect` и `lib/timezones.ts`. Нужен планам [7] (dashboard) и [9] (update-profile). Также поставляет `viewerTimezone`-логику, используемую [2], [5], [6], [8].
- **[2] showcase-card slots** — создаёт `ShowcaseSlotBadge`/`ShowcaseSlotsList`, переиспользуемые в [3] и [5].
- **[3] slot-picker** — конструктор слотов автора; зависит от [1] (таймзона автора) и [2] (компоненты показа).
- **[4] slot-selection (P0)** — критический путь: обязательный выбор слота + обработка 409. Зависит только от [0]: `SlotSelectorRadioGroup` самостоятелен и **не** переиспользует компоненты [2], поэтому [4] не блокируется [2].
- **[5]–[9]** — потребители готовых компонентов/правил, независимы между собой (можно параллелить).

## 4. Порядок выполнения

> Номера шагов ниже — это **порядок исполнения**, а не ID планов из §2 (шаг 3 = `[2]`, шаг 4 = `[1]`). ID планов: `[0]` shared, `[1]` timezone, `[2]` availability-slots, `[3]` slot-picker, `[4]` slot-selection, `[5]` assigned-slot, `[6]` slot-stats, `[7]` timezone-sync, `[8]` notification, `[9]` update-profile.

### Фаза 0. Backend-предпосылки (обязательно до Фазы A)
0. **[B] backend: `User.timezone` в профиле** — добавить `timezone` в `USER_PROFILE_SELECT` и `userProfileSchema` (`packages/dto`), сохранять `dto.timezone` в `UsersService.updateProfile`, регенерировать OpenAPI → Orval → `packages/api`. Без этого `viewerTimezone` и сохранение таймзоны не работают.

### Фаза A. База (обязательно первая)
1. **[0] shared/datetime-and-i18n-rules** — изучить правила, зафиксировать чек-листы. Создать i18n namespace `showcase` со всеми ключами (`slots.*`, `profile.*`). Определить общий тип `AvailabilitySlot` (см. §2.1 в спецификации правил) или зафиксировать конкретные generated-типы.

### Фаза B. Критический путь (P0)
2. **[4] features/send-match-request/slot-selection** — обязательный выбор `slotId`, обработка `409 Conflict`. Самый высокий приоритет: без него отклик на карточки со слотами невозможен. Не зависит от [2] и может идти параллельно с Фазой C.

### Фаза C. Основа слотов (P1)
3. **[2] entities/showcase-card/availability-slots** — компоненты показа слотов в витрине.
4. **[1] entities/user/timezone** — `TimezoneSelect` + справочник (нужен для формы и дашборда).
5. **[3] features/manage-showcase-card/slot-picker** — конструктор слотов в форме анкеты.

### Фаза D. Отображение (P1)
6. **[5] widgets/match-requests-hub/assigned-slot-display** — слот в заявках + баннер.
7. **[6] widgets/my-cards-list/slot-stats** — счётчики слотов в «Моих анкетах».

### Фаза E. Таймзона и уведомления (P2)
8. **[7] widgets/dashboard/timezone-sync** — замена `useState("UTC")` на профильную таймзону.
9. **[8] entities/notification/notification-slot-time** — рендер времени слота в уведомлениях.

### Фаза F. Безопасность (P2/P3)
10. **[9] features/update-profile/timezone-and-security** — таймзона в профиле + подтверждающие диалоги отвязки (ADR-005).

## 5. Параллелизация

После завершения Фазы C следующие работы независимы и могут выполняться параллельно:
- **[5]**, **[6]** (виджеты отображения)
- **[7]**, **[8]**, **[9]** (таймзона/уведомления/безопасность)

Фаза B ([4]) может выполняться параллельно с Фазой C: `SlotSelectorRadioGroup` не зависит от компонентов [2].

## 6. Контрольные точки (Gate)

| Gate | Условие перехода | Проверка |
|---|---|---|
| Start → G1 | Backend [B] готов | `GET /profile/me` возвращает `timezone`; `PATCH /profile/me` сохраняет его; `packages/api` регенерирован |
| G1 → G2 | Правила [0] усвоены, i18n `showcase` создан, тип `AvailabilitySlot` определён | namespace присутствует в `packages/i18n`, `useTranslation('showcase')` типобезопасен |
| G2 → G3 | [4] завершён | `SendMatchRequestDialog` передаёт `slotId`, 409 обработан; unit-тесты проходят |
| G3 → G4 | [2], [1], [3] завершены | Форма сохраняет 1–10 слотов, витрина показывает слоты в `viewerTimezone` |
| G4 → G5 | [5], [6] завершены | Заявки показывают `req.slot`, «Мои анкеты» — счётчики |
| G5 → Done | [7], [8], [9] завершены + финальные проверки | DoD раздела 7 |

## 7. Общий Definition of Done (DoD)

- [ ] Backend: `GET /profile/me` возвращает `timezone`, `PATCH /profile/me` сохраняет его; OpenAPI/Orval/`packages/api` регенерированы.
- [ ] Backend [B]: принято и зафиксировано решение по `User.timezone` (`@default("Europe/Moscow")`, non-nullable) — оставить default / nullable + браузерный фоллбэк / автоопределение; тип `userProfileSchema` соответствует решению.
- [ ] `pnpm --filter web exec tsc --noEmit` — 0 ошибок.
- [ ] Отсутствуют прямые импорты `date-fns`, `@date-fns/tz`, `dayjs`, `luxon`, `date-fns-tz`, `moment` в `apps/web/src/**`.
- [ ] Общий тип `AvailabilitySlot` определён и используется (или зафиксированы конкретные generated-типы без локальных дублей).
- [ ] Поля `slots`/`slotId` типизированы через `@packages/api`/`@packages/dto`.
- [ ] `SendMatchRequestDialog`: обязателен выбор слота при наличии OPEN-слотов; `slotId` передаётся; 409 обработан (toast + invalidateQueries + сброс выбора).
- [ ] `ShowcaseCardForm`: 1–10 слотов; запрет слота в прошлом; BOOKED нельзя удалить; слоты в live-preview; ответ API `422` (несуществующее локальное время, DST) показан пользователю.
- [ ] BOOKED-слоты **исключаются** из полезной нагрузки `slots` при создании/обновлении (иначе `replaceSlots` даёт `409`); в форме BOOKED отображаются только для чтения.
- [ ] Все импорты времени — из `@packages/utils` (не `@packages/utils/datetime`).
- [ ] Локаль форматирования решена: `formatInstantInTimeZone` без locale даёт английские названия месяцев/дней; сигнатура расширена либо текстовые токены не используются.
- [ ] Каталог и заявки отображают слоты в таймзоне смотрящего.
- [ ] Профиль: выбор и сохранение IANA-таймзоны; автодетект; дашборд использует профильную таймзону.
- [ ] Уведомления рендерят `payload.slotStartsAt` в таймзоне пользователя.
- [ ] Отвязка Telegram/GitHub требует подтверждения с предупреждением о ревокации сессий; подтверждающий диалог реализован (общий `ConfirmDialog` в `@packages/ui` создан **или** зафиксирован app-local паттерн).
- [ ] Unit-тесты написаны: `SendMatchRequestDialog`, `ShowcaseCardForm`, `ShowcaseSlotsList`, `TimezoneSelect`, `IncomingRequestCard`, `OutgoingRequestCard`, `MatchedSessionBanner`, `MyCardItem`, `NotificationItem`, `ConnectedAccountsSection`.
- [ ] `pnpm --filter web exec vitest run` — успешно. Тесты, зависящие от `now()`, фиксируют часы (`vi.useFakeTimers()`/`setSystemTime` + сброс).
- [ ] i18n-ключи добавлены в RU/EN `showcase.json`, типы обновлены.

## 8. Связанные документы

- [Задача: Frontend for slot scheduling, interview booking, and security (ADR-002…ADR-005)](../../tasks/Frontend%20for%20slot%20scheduling%2C%20interview%20booking%2C%20and%20security%20%28ADR-002%E2%80%A6ADR-005%29.md)
- [ADR-002: Расписание собеседований, слоты доступности и таймзоны](../../adr/ADR-002.md)
- [ADR-003: Доменные события и диспетчер уведомлений](../../adr/ADR-003.md)
- [ADR-004: Транспорт доставки уведомлений](../../adr/ADR-004.md)
- [ADR-005: Security-уведомления и аудит событий безопасности](../../adr/ADR-005.md)
