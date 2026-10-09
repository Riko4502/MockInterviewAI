# План реализации: единые правила работы с датой/временем и i18n

## 1. Цель плана

Собрать единый чек-лист проверок и порядок внедрения кросс-нарезных правил для всей фичи слотов/таймзон/безопасности отвязки.

## 2. Этапы внедрения (0–9)

### Этап 0. Подготовка (0.25–0.5 ч)
- [ ] Ознакомиться с экспортами `@packages/utils/datetime`: `formatInstantInTimeZone`, `isIanaTimeZoneFormat`, `isResolvableTimeZone`.
- [ ] Проверить наличие `@packages/ui` (ConfirmDialog) для подтверждающих диалогов.
- [ ] Быстрый поиск прямых импортов дат в `apps/web/src`: `date-fns`, `@date-fns/tz`, `dayjs`, `luxon`, `date-fns-tz`, `moment`.
- [ ] Создать ветку фичи от `dev`.

### Этап 1. P0 — SendMatchRequest: выбор слота + 409
- [ ] `features/send-match-request/ui/SlotSelectorRadioGroup.tsx` (NEW)
- [ ] `features/send-match-request/ui/SendMatchRequestDialog.tsx` (EDIT) — интеграция, обязательность выбора, обработка 409 (toast + invalidateQueries + сброс slotId)

### Этап 2. P1 — Manage showcase: конструктор слотов
- [ ] `features/manage-showcase-card/model/showcase-form-schema.ts` (EDIT) — `slotItemSchema`, `slots`, мапперы
- [ ] `features/manage-showcase-card/ui/SlotPickerField.tsx` (NEW) — FieldArray, дата/время/длительность, проверка «не в прошлом», блокировка удаления BOOKED
- [ ] `features/manage-showcase-card/ui/ShowcaseCardLivePreview.tsx` (EDIT)
- [ ] `features/manage-showcase-card/ui/EditCardView.tsx` (EDIT) — UTC→startsAtLocal в `userTimezone`
- [ ] `features/manage-showcase-card/ui/ShowcaseCardForm.tsx` (EDIT) — интеграция

### Этап 3. P1 — ShowcaseCard: отображение слотов в витрине
- [ ] `entities/showcase-card/ui/ShowcaseSlotBadge.tsx` (NEW)
- [ ] `entities/showcase-card/ui/ShowcaseSlotsList.tsx` (NEW) — фильтр OPEN+future, сортировка, макс. 3 + `+N ещё`
- [ ] `entities/showcase-card/lib/format-card-slot.ts` (NEW)
- [ ] `entities/showcase-card/ui/ShowcaseCard.tsx` (EDIT) — блок «Ближайшие слоты» в `viewerTimezone`

### Этап 4. P1 — MatchRequestsHub: отображение назначенного слота
- [ ] `widgets/match-requests-hub/ui/IncomingRequestCard.tsx` (EDIT)
- [ ] `widgets/match-requests-hub/ui/OutgoingRequestCard.tsx` (EDIT)
- [ ] `widgets/match-requests-hub/ui/MatchedSessionBanner.tsx` (EDIT)

### Этап 5. P1 — i18n: namespace `showcase`
- [ ] `packages/i18n/src/locales/ru/showcase.json` (NEW/EDIT)
- [ ] `packages/i18n/src/locales/en/showcase.json` (NEW/EDIT)
- [ ] Обновление типов i18n в `packages/i18n` (namespace `showcase`)

### Этап 6. P2 — Timezone + Notifications + Dashboard
- [ ] `entities/user/lib/timezones.ts` (NEW) — POPULAR_TIMEZONES, `getBrowserTimezone`
- [ ] `entities/user/ui/TimezoneSelect.tsx` (NEW) — поиск, группы, автодетект
- [ ] `features/update-profile/ui/GeneralTab.tsx` (EDIT) — интеграция таймзоны
- [ ] `features/update-profile/model/profile-form-schema.ts` (EDIT) — поле `timezone`
- [ ] `widgets/dashboard/ui/upcoming-session/DashboardUpcomingSession.tsx` (EDIT) — `userTimezone`
- [ ] `widgets/dashboard/ui/analytics/DashboardRecentSessions.tsx` (EDIT) — `userTimezone`
- [ ] `entities/notification/ui/NotificationItem.tsx` (EDIT) — рендер `payload.slotStartsAt` в `userTimezone`

### Этап 7. P3 — Безопасная отвязка аккаунтов
- [ ] `features/update-profile/ui/ConnectedAccountsSection.tsx` (EDIT) — ConfirmDialog при отвязке Telegram/GitHub

### Этап 8. Тестирование и проверка качества
- [ ] Unit-тесты: `SendMatchRequestDialog.test.tsx`, `ShowcaseCardForm.test.tsx`, `IncomingRequestCard.test.tsx`, `OutgoingRequestCard.test.tsx`
- [ ] `pnpm --filter web exec tsc --noEmit`
- [ ] Проверка запрета прямых импортов дат (grep)
- [ ] `pnpm --filter web exec vitest run`

### Этап 9. Финальная проверка (smoke)
- [ ] i18n-ключи вместо хардкода
- [ ] Корректность timezone-контекстов (viewer/author)
- [ ] Поведение пустых массивов слотов
- [ ] 409: диалог открыт, выбор сброшен, тост показан

## 3. Контрольные проверки (must-have)

| Проверка | Команда/критерий | Статус |
|---|---|---|
| **TypeScript** | `pnpm --filter web exec tsc --noEmit` — 0 ошибок | [ ] |
| **Запрет прямых импортов дат** | `grep -R --include="*.ts" --include="*.tsx" -E "(from ['\"](date-fns|@date-fns/tz|dayjs|luxon|date-fns-tz|moment)['\"])" apps/web/src` — пусто | [ ] |
| **Единый фасад datetime** | Весь форматинг через `@packages/utils/datetime` (`formatInstantInTimeZone`, валидация IANA) | [ ] |
| **Разделение таймзон** | `viewerTimezone` для показа, `authorTimezone` для `startsAtLocal` при редактировании | [ ] |
| **IANA-валидация** | Двухшаговая: `isIanaTimeZoneFormat` + `isResolvableTimeZone`. Без whitelist через `supportedValuesOf` | [ ] |
| **Контракты API** | `slots`/`slotId` типизированы через `@packages/api`/`@packages/dto`. Только `startsAtLocal` + `durationMinutes` при создании/обновлении карточки | [ ] |
| **409 Conflict** | Обработан: toast, `invalidateQueries`, сброс `slotId`, диалог не закрывается | [ ] |
| **Бизнес-правила** | Обязательность выбора при наличии OPEN+future, 1–10 слотов, запрет слота в прошлом, BOOKED нельзя удалить | [ ] |
| **i18n namespace `showcase`** | Ключи `slots.*`, `profile.*` в RU/EN, типы обновлены | [ ] |
| **Тесты web** | `pnpm --filter web exec vitest run` — успешно | [ ] |

## 4. Список файлов к созданию/правке (сводка)

### Новые
- `entities/showcase-card/ui/ShowcaseSlotBadge.tsx`
- `entities/showcase-card/ui/ShowcaseSlotsList.tsx`
- `entities/showcase-card/lib/format-card-slot.ts`
- `entities/user/lib/timezones.ts`
- `entities/user/ui/TimezoneSelect.tsx`
- `features/send-match-request/ui/SlotSelectorRadioGroup.tsx`
- `features/manage-showcase-card/ui/SlotPickerField.tsx`

### Правки
- `entities/showcase-card/ui/ShowcaseCard.tsx`
- `entities/notification/ui/NotificationItem.tsx`
- `features/send-match-request/ui/SendMatchRequestDialog.tsx`
- `features/manage-showcase-card/model/showcase-form-schema.ts`
- `features/manage-showcase-card/ui/ShowcaseCardLivePreview.tsx`
- `features/manage-showcase-card/ui/EditCardView.tsx`
- `features/manage-showcase-card/ui/ShowcaseCardForm.tsx`
- `features/update-profile/ui/GeneralTab.tsx`
- `features/update-profile/model/profile-form-schema.ts`
- `features/update-profile/ui/ConnectedAccountsSection.tsx`
- `widgets/match-requests-hub/ui/IncomingRequestCard.tsx`
- `widgets/match-requests-hub/ui/OutgoingRequestCard.tsx`
- `widgets/match-requests-hub/ui/MatchedSessionBanner.tsx`
- `widgets/my-cards-list/ui/MyCardItem.tsx`
- `widgets/dashboard/ui/upcoming-session/DashboardUpcomingSession.tsx`
- `widgets/dashboard/ui/analytics/DashboardRecentSessions.tsx`

### i18n
- `packages/i18n/src/locales/ru/showcase.json`
- `packages/i18n/src/locales/en/showcase.json`
- Обновление типов в `packages/i18n`
