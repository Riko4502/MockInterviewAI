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

## 3. Граф зависимостей

```text
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

- **[0] shared** — фундамент: правила `@packages/utils/datetime`, запрет прямых импортов дат, разделение `viewerTimezone`/`authorTimezone`, двухшаговая IANA-валидация, i18n namespace `showcase`. Ни один другой план не начинается до усвоения этих правил.
- **[1] timezone** — создаёт `TimezoneSelect` и `lib/timezones.ts`. Нужен планам [7] (dashboard) и [9] (update-profile). Также поставляет `viewerTimezone`-логику, используемую [2], [5], [6], [8].
- **[2] showcase-card slots** — создаёт `ShowcaseSlotBadge`/`ShowcaseSlotsList`, переиспользуемые в [3], [4], [5].
- **[3] slot-picker** — конструктор слотов автора; зависит от [1] (таймзона автора) и [2] (компоненты показа).
- **[4] slot-selection (P0)** — критический путь: обязательный выбор слота + обработка 409. Зависит от [0] и переиспользует компоненты [2].
- **[5]–[9]** — потребители готовых компонентов/правил, независимы между собой (можно параллелить).

## 4. Порядок выполнения

### Фаза A. База (обязательно первая)
1. **[0] shared/datetime-and-i18n-rules** — изучить правила, зафиксировать чек-листы. Создать i18n namespace `showcase` со всеми ключами (`slots.*`, `profile.*`).

### Фаза B. Критический путь (P0)
2. **[4] features/send-match-request/slot-selection** — обязательный выбор `slotId`, обработка `409 Conflict`. Самый высокий приоритет: без него отклик на карточки со слотами невозможен.

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

Фаза B ([4]) может выполняться параллельно с Фазой C при условии переиспользования ещё не готовых компонентов через временные интерфейсы, но предпочтительно после **[2]**.

## 6. Контрольные точки (Gate)

| Gate | Условие перехода | Проверка |
|---|---|---|
| G1 → G2 | Правила [0] усвоены, i18n `showcase` создан | namespace присутствует в `packages/i18n`, `useTranslation('showcase')` типобезопасен |
| G2 → G3 | [4] завершён | `SendMatchRequestDialog` передаёт `slotId`, 409 обработан; unit-тесты проходят |
| G3 → G4 | [2], [1], [3] завершены | Форма сохраняет 1–10 слотов, витрина показывает слоты в `viewerTimezone` |
| G4 → G5 | [5], [6] завершены | Заявки показывают `req.slot`, «Мои анкеты» — счётчики |
| G5 → Done | [7], [8], [9] завершены + финальные проверки | DoD раздела 7 |

## 7. Общий Definition of Done (DoD)

- [ ] `pnpm --filter web exec tsc --noEmit` — 0 ошибок.
- [ ] Отсутствуют прямые импорты `date-fns`, `@date-fns/tz`, `dayjs`, `luxon`, `date-fns-tz`, `moment` в `apps/web/src/**`.
- [ ] Поля `slots`/`slotId` типизированы через `@packages/api`/`@packages/dto`.
- [ ] `SendMatchRequestDialog`: обязателен выбор слота при наличии OPEN-слотов; `slotId` передаётся; 409 обработан (toast + invalidateQueries + сброс выбора).
- [ ] `ShowcaseCardForm`: 1–10 слотов; запрет слота в прошлом; BOOKED нельзя удалить; слоты в live-preview.
- [ ] Каталог и заявки отображают слоты в таймзоне смотрящего.
- [ ] Профиль: выбор и сохранение IANA-таймзоны; автодетект; дашборд использует профильную таймзону.
- [ ] Уведомления рендарят `payload.slotStartsAt` в таймзоне пользователя.
- [ ] Отвязка Telegram/GitHub требует подтверждения с предупреждением о ревокации сессий.
- [ ] Unit-тесты (`SendMatchRequestDialog`, `ShowcaseCardForm`, `IncomingRequestCard`, `OutgoingRequestCard`) написаны.
- [ ] `pnpm --filter web exec vitest run` — успешно.
- [ ] i18n-ключи добавлены в RU/EN `showcase.json`, типы обновлены.

## 8. Связанные документы

- [Задача: Frontend for slot scheduling, interview booking, and security (ADR-002…ADR-005)](../../../tasks/Frontend%20for%20slot%20scheduling%2C%20interview%20booking%2C%20and%20security%20%28ADR-002%E2%80%A6ADR-005%29.md)
- [ADR-002: Расписание собеседований, слоты доступности и таймзоны](../../../adr/ADR-002.md)
- [ADR-003: Доменные события и диспетчер уведомлений](../../../adr/ADR-003.md)
- [ADR-004: Транспорт доставки уведомлений](../../../adr/ADR-004.md)
- [ADR-005: Security-уведомления и аудит событий безопасности](../../../adr/ADR-005.md)
