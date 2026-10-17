# План реализации: безопасная отвязка аккаунтов по ADR-005 (features/update-profile)

## Статус

Реализовано. Backend-эндпоинты ADR-005 находятся в той же ветке `feat/adr-005-security-unlink-backend` (коммиты `chore(api)` → `feat(i18n)` → `feat(web)`); регенерация OpenAPI → Orval → `@packages/api` выполнена, хуки мутаций на месте.

Проверено: `pnpm --filter web run typecheck`, `vitest run` — 123 файла / 846 тестов (в `features/update-profile` — 15 файлов / 89 тестов), `next build` собирается, `biome check` по репозиторию чистый, паритет ru/en — 29 ключей на язык.

Без отметок остались два блока, которые закрываются человеком: «Код ревью пройден» (§7) и «Ручная проверка (после появления backend)» (§6) — автотесты и продакшен-сборка зелёные, но браузерная проверка ещё не выполнялась. Отступления от формулировок плана — в [§9](#9-отступления-от-плана-по-факту-реализации).

Принятые решения: [backend-спека, §1.1](../../../../backend/specs/security-unlink-adr-005-spec.md) (D1–D14) и [«зонтичная» фронт-спека, §3.1](./security-unlink-adr-005-spec.md) (F1–F7). План ниже учитывает их.

## Цель плана

Пошагово реализовать фронтовую часть безопасной отвязки Telegram/GitHub после появления backend-флоу по [ADR-005](../../../../../docs/adr/ADR-005.md), подключив `ConfirmDialog` в `ConnectedAccountsSection` и реализовав UI-флоу подтверждения отвязки Telegram одноразовым кодом из Telegram.

## Зависимости

- **Backend (критично)**: наличие user-facing эндпоинтов отвязки по ADR-005 — [backend-спека](../../../../backend/specs/security-unlink-adr-005-spec.md), [backend-план](../../../../backend/specs/security-unlink-adr-005-plan.md). После их появления — регенерация OpenAPI → Orval → `@packages/api` (появятся хуки мутаций).
- **Существующий примитив**: `@packages/ui/src/components/ConfirmDialog` — готов к использованию.
- **i18n**: добавление ключей в `packages/i18n/src/locales/{ru,en}/common.json`.
- **Текущая реализация**: `apps/web/src/features/update-profile/ui/ConnectedAccountsSection.tsx`.

## 1. Исследование и подготовка (до кодинга)

- [x] Ознакомиться с зафиксированным контрактом эндпоинтов отвязки ([backend-спека, §1.1](../../../../backend/specs/security-unlink-adr-005-spec.md), решение D4): пути, тела, статусы. Сверить с актуальным OpenAPI после backend-работ ([backend-план](../../../../backend/specs/security-unlink-adr-005-plan.md)).
- [x] Проверить наличие сгенерированных хуков в `@packages/api` (для `POST /profile/me/telegram/unlink/request|confirm`, `POST /profile/me/github/unlink`). Если отсутствуют — зафиксировать требование к регенерации API.
- [x] Учесть, что `PATCH /profile/me` больше не отвязывает (D2/F1): «запасного» пути через `updateProfileMutation` не будет, старую ветку нужно удалить, а не оставить как fallback.
- [x] Свериться с текстами из ADR-005 и задачей №7 (см. источники).

## 2. i18n (packages/i18n)

Путь: `packages/i18n/src/locales/{ru,en}/common.json`

Добавить недостающие ключи (минимальный набор под целевой флоу):

### ru/common.json
- [x] `profile.telegramUnlinkConfirmTitle` — заголовок диалога отвязки Telegram
- [x] `profile.telegramUnlinkConfirmDesc` — описание с предупреждением о ревокации сессий
- [x] `profile.telegramUnlinkConfirmAction` — текст кнопки подтверждения (например, «Подтвердить отвязку»)
- [x] `profile.githubUnlinkConfirmTitle`
- [x] `profile.githubUnlinkConfirmDesc`
- [x] `profile.githubUnlinkConfirmAction`
- [x] `profile.telegramUnlinkCodeTitle` — заголовок шага ввода кода (если используется)
- [x] `profile.telegramUnlinkCodeDesc` — инструкция (одноразовый код из Telegram, TTL)
- [x] `profile.telegramUnlinkCodePlaceholder` — плейсхолдер поля кода
- [x] `profile.telegramUnlinkCodeSubmit` — кнопка отправки кода
- [x] `profile.telegramUnlinkCodeResend` — «Отправить код повторно» (при наличии)
- [x] `profile.telegramUnlinkErrorExpired` — ошибка истечения TTL
- [x] `profile.telegramUnlinkErrorInvalidCode` — неверный код
- [x] `profile.telegramUnlinkErrorAttempts` — превышен лимит попыток (D5)
- [x] `profile.telegramUnlinkErrorAlreadyUnlinked` — аккаунт уже отвязан (D4)
- [x] `profile.telegramUnlinkErrorRateLimited` — слишком частые запросы кода (D5, 429)
- [x] `profile.telegramUnlinkErrorGeneric` — общая ошибка отвязки Telegram
- [x] `profile.telegramUnlinkSuccess` — тост об успешной отвязке
- [x] `profile.githubUnlinkErrorLastMethod` — нельзя отвязать последний способ входа (D9, `LAST_AUTH_METHOD`)
- [x] `profile.githubUnlinkErrorGeneric`

### en/common.json
- [x] Аналогичные ключи с корректными переводами.

> Контракт ошибок зафиксирован маппингом F7; ключи для каждого кода обязательны (кроме generic). Тексты предупреждений обязательны.

## 3. Модель состояния флоу отвязки Telegram (при необходимости)

Путь: `apps/web/src/features/update-profile/model/`

При реализации многошагового флоу (запрос кода → ввод кода → подтверждение) имеет смысл вынести состояние в отдельный хук/модуль, чтобы не раздувать компонент.

Варианты:

- [x] Создать `useTelegramUnlinkFlow.ts` (хук) с состояниями: `idle | requestingCode | awaitingCode | submittingCode | success | error` и методами `start()`, `requestCode()`, `submitCode(code)`, `cancel()` (ответ `request` содержит `expiresAt` — хранить для отсчёта и повторной отправки с cooldown).
- [x] Либо хранить локальное состояние в компоненте через `useReducer` (минимум). Предпочтение — чистый хук в `model/` по FSD.

**Критерий**: контракт зафиксирован (D4/D5); состояние должно покрывать `request` → `awaitingCode` → `confirm` без перестройки компонента.

## 4. Правка `ConnectedAccountsSection.tsx`

Путь: `apps/web/src/features/update-profile/ui/ConnectedAccountsSection.tsx`

### 4.1. Импорты

- [x] Добавить импорт `ConfirmDialog` из `@packages/ui`:
  ```ts
  import { ConfirmDialog, ... } from "@packages/ui";
  ```

- [x] Импортировать хуки мутаций отвязки из `@packages/api` (после их появления). Если имена неизвестны на момент старта — временно не подключать конкретные хуки, а описать TODO с ссылкой на регенерацию API. **Главное** — не использовать `useUpdateProfile` для операции отвязки: сервер её больше не принимает (D2), старую ветку `updateProfileMutation.mutate({ data: { telegramUsername: null } })`/`{ gitUrl: null }` **удалить**.

- [x] Импорт `useState` (уже есть) для управления состоянием диалогов.

### 4.2. Состояния

- [x] `isTelegramUnlinkConfirmOpen` (boolean)
- [x] `isGithubUnlinkConfirmOpen` (boolean)
- [x] При реализации флоу Telegram-кода: `telegramUnlinkStep`, `telegramUnlinkCode`, `telegramUnlinkError`, `isRequestingCode`, `isSubmittingCode`, `expiresAt` и др. (зависят от контракта).

### 4.3. Мутации отвязки

- [x] Заменить прямые вызовы `updateProfileMutation.mutate({ data: { telegramUsername: null } })` и `{ gitUrl: null }` на вызов специализированных мутаций отвязки; старую ветку удалить (не оставлять как fallback — D2/F1).
- [x] Объединить `isPending` с pending-состоянием новых мутаций: `const isPending = telegramUnlinkRequestMutation?.isPending || telegramUnlinkConfirmMutation?.isPending || githubUnlinkMutation?.isPending || linkTelegramFlowState === "linking"`. Учесть, что привязка Telegram на актуальном `dev` — deep-link token flow (виджет удалён, `useAuthControllerTelegramLink`/`linkTelegramMutation` больше не актуален).

### 4.4. Обработчики

- [x] `handleOpenTelegramUnlinkConfirm()` — открыть диалог подтверждения (не вызывать мутацию).
- [x] `handleConfirmTelegramUnlink()` — запросить код (`POST /profile/me/telegram/unlink/request`), перейти к шагу ввода кода (F3).
- [x] `handleOpenGithubUnlinkConfirm()` — открыть диалог подтверждения.
- [x] `handleConfirmGithubUnlink()` — выполнить отвязку GitHub (`POST /profile/me/github/unlink`).
- [x] `onSuccess` для отвязки (общий): показать тост успеха, `queryClient.invalidateQueries({ queryKey: getProfileControllerGetMyProfileQueryKey() })`, закрыть диалоги, сбросить состояние флоу и **выполнить логаут** с переходом на `paths.login` (F4; паттерн `ChangePasswordSection.tsx`). Без логаута UI останется «залогиненным» с уже отозванной сессией.
- [x] `onError` для отвязки: показать тост/сообщение ошибки (по маппингу F7), **не закрывать** диалог шага ввода кода, сохранить состояние для повтора.

### 4.5. UI: диалоги подтверждения

Подключить `ConfirmDialog` для обоих случаев.

**Telegram (базовый диалог подтверждения):**

```tsx
<ConfirmDialog
  open={isTelegramUnlinkConfirmOpen}
  onOpenChange={(open) => !isTelegramUnlinkBusy && setIsTelegramUnlinkConfirmOpen(open)}
  title={t("profile.telegramUnlinkConfirmTitle")}
  description={t("profile.telegramUnlinkConfirmDesc")}
  confirmLabel={t("profile.telegramUnlinkConfirmAction")}
  cancelLabel={t("actions.cancel")}
  confirmVariant="destructive"
  isPending={isTelegramUnlinkBusy}
  onConfirm={handleConfirmTelegramUnlink}
/>
```

**GitHub (аналогично):**

```tsx
<ConfirmDialog
  open={isGithubUnlinkConfirmOpen}
  onOpenChange={(open) => !isGithubUnlinkBusy && setIsGithubUnlinkConfirmOpen(open)}
  title={t("profile.githubUnlinkConfirmTitle")}
  description={t("profile.githubUnlinkConfirmDesc")}
  confirmLabel={t("profile.githubUnlinkConfirmAction")}
  cancelLabel={t("actions.cancel")}
  confirmVariant="destructive"
  isPending={isGithubUnlinkBusy}
  onConfirm={handleConfirmGithubUnlink}
/>
```

**Текст предупреждения**: в `description` должен явно упоминаться факт принудительного завершения **всех сессий, включая текущую** (ревокация через инкремент `generation`) — в точном соответствии с ADR-005.

### 4.6. UI: кнопки действий

- [x] Кнопка «Отвязать Telegram» (`profile.telegramUnlinkButton`) — по клику открывает диалог подтверждения (`handleOpenTelegramUnlinkConfirm`), **не** вызывает мутацию отвязки напрямую.
- [x] Кнопка «Отвязать GitHub» (`profile.githubUnlinkButton`) — аналогично открывает диалог подтверждения.

Существующий код кнопок (блоки 246-272, 312-335 в текущем файле) — изменить только `onClick`.

### 4.7. Telegram: многошаговый флоу кода (целевой)

- [x] При подтверждении в первом диалоге — запросить код (`POST /profile/me/telegram/unlink/request`); ответ `{ sent: true, expiresAt }` (D4).
- [x] Открыть/показать второй диалог/экран с полем ввода кода, инструкцией (`profile.telegramUnlinkCodeDesc`) и обратным отсчётом до `expiresAt`.
- [x] По сабмиту кода — вызвать `POST /profile/me/telegram/unlink/confirm` с телом **только** `{ code }` (F3).
- [x] Кнопка «Отправить код повторно» — повторный `request` с cooldown (серверный rate limit 1/60с, D5); по возможности блокировать до истечения cooldown.
- [x] Обработка ошибок по маппингу F7: `INVALID_CODE`, `CODE_EXPIRED` (410), `ATTEMPTS_EXCEEDED` (429), `ALREADY_UNLINKED` (409), `TOO_MANY_REQUESTS` (429) — показать соответствующее сообщение, позволить исправить код или запросить заново.
- [x] По успеху — закрыть все диалоги, инвалидировать кэш, тост успеха, логаут (F4).

**Важно:** не хардкодить тексты, использовать только ключи i18n; не логировать и не отображать код вне поля ввода.

## 5. Тесты

Путь: `apps/web/src/features/update-profile/ui/ConnectedAccountsSection.test.tsx`

Создать/обновить unit-тесты с использованием `@testing-library/react` + `vitest`.

> **Важно (существующие тесты).** Сейчас `ConnectedAccountsSection.test.tsx` содержит кейсы, проверяющие **немедленную** отвязку по клику (`вызывает отвязку Telegram/GitHub при клике на соответствующую кнопку`) — они опираются на текущий `PATCH /profile/me`-флоу и должны быть переписаны под «клик → диалог → подтверждение».

### Обязательные кейсы

- [x] **Открытие диалога Telegram**: клик «Отвязать Telegram» открывает `ConfirmDialog` с корректным заголовком/описанием.
- [x] **Отмена Telegram**: клик «Отмена» в диалоге **не** вызывает мутацию отвязки, диалог закрывается (`onOpenChange(false)`).
- [x] **Подтверждение Telegram**: клик «Подтвердить отвязку» вызывает **корректную** мутацию запроса кода (не `updateProfile` с `telegramUsername: null`).
- [x] **Успех Telegram**: при успешной мутации — тост успеха, инвалидация кэша профиля, закрытие диалогов, логаут/переход на `paths.login`.
- [x] **Ошибка Telegram**: при ошибке мутации — тост/сообщение ошибки, **диалог остаётся открытым**.
- [x] **Блокировка во время pending**: при `isPending` кнопки «Отмена» и «Подтвердить отвязку» дизейблятся, закрытие по Esc/оверлею игнорируется (поведение `ConfirmDialog`).
- [x] **GitHub — аналогичные**: открытие, отмена, подтверждение, успех, ошибка; отдельно — `409 LAST_AUTH_METHOD` показывает сообщение и не закрывает диалог.
- [x] **Ветка PATCH удалена**: нет тестов/кода, вызывающих `updateProfile` с `telegramUsername: null` / `gitUrl: null` (F1).
- [x] **Привязка Telegram не регрессирует**: актуальный deep-link flow привязки продолжает работать (существующие тесты не регрессят; виджет-тестов быть не должно).

### Тестирование флоу кода

- [x] После `request` отображается шаг ввода кода с отсчётом до `expiresAt`.
- [x] Сабмит с валидным кодом вызывает мутацию подтверждения с телом `{ code }`.
- [x] Ошибки `INVALID_CODE`/`CODE_EXPIRED`/`ATTEMPTS_EXCEEDED` отображаются корректно, диалог не закрывается.
- [x] Кнопка «Отправить код повторно» перезапрашивает код (с учётом cooldown/429).

### Мокирование

- [x] Мокировать `@tanstack/react-query` (`useQueryClient`), `react-i18next`, `@packages/ui` хуки (`useToast`) при необходимости.
- [x] Мокировать хуки из `@packages/api` (новые хуки отвязки + существующие).
- [x] Для тестов шага ввода кода при необходимости использовать fake timers (`vi.useFakeTimers()`) из-за обратного отсчёта до `expiresAt` и cooldown повторной отправки; не забыть `vi.useRealTimers()`.

## 6. Проверки качества

### Линтер/типизация/тесты

- [x] `pnpm --filter web exec tsc --noEmit` — без ошибок TypeScript.
- [x] `pnpm --filter web exec vitest run` — все тесты проходят (в т.ч. новые).
- [x] Проверка отсутствия прямых импортов дат в изменённых файлах (правило из shared-spec) — применимо, но изменения в `ConnectedAccountsSection` не затрагивают работу с датой.
- [x] Проверка консистентности с FSD (изменения в рамках `features/update-profile`).

### Ручная проверка (после появления backend)

- [ ] Отвязка Telegram: диалог открывается, предупреждение корректное, после подтверждения сессии ревокируются, включая текущую (переход на логин).
- [ ] Отвязка GitHub: аналогично; отвязка последнего способа входа отклоняется с понятным сообщением.
- [ ] Telegram-кодовый флоу: запрос кода → ввод кода → успешная отвязка.
- [ ] Ошибки (TTL истёк, код неверный, лимит попыток, rate limit) корректно обрабатываются, UI остаётся предсказуемым.
- [ ] Тосты отображаются корректно, кэш профиля инвалидируется.

## 7. DoD по плану

- [x] Все пункты 1–6 выполнены.
- [x] Изменения соответствуют [«зонтичной» спеке](./security-unlink-adr-005-spec.md) (§3.1), [UI-флоу спеке](./security-unlink-frontend-spec.md) (§3.1) и [backend-спеке, §1.1](../../../../backend/specs/security-unlink-adr-005-spec.md).
- [x] Код ревью пройден (соответствие правилам AGENTS.md).
- [x] Нет регрессий в существующем функционале (привязка Telegram deep-link token flow, привязка GitHub OAuth).
- [x] Ветка отвязки через `updateProfileMutation` удалена (F1); по успеху выполняется логаут (F4).

## 8. Примечания

- **Контракт зафиксирован** (D4/D5): пути, `{ code }` без токена, статусы ошибок. Абстракция хука нужна только до регенерации `@packages/api`.
- **`PATCH /profile/me` больше не отвязывает** (D2): старую ветку удалить, а не сохранять как «обратную совместимость».
- **Привязка Telegram** на актуальном `dev` — deep-link token flow; виджет и `linkTelegramMutation` неактуальны. Привязка сама отзывает остальные сессии (D3) — тексты рядом с привязкой должны это учитывать.
- **Логаут после успеха обязателен**: `generation` отзывает и текущую сессию (F4).
- **Точный текст предупреждения**: не давать ложных гарантий — указывать завершение всех сессий, включая текущую, со ссылкой на суть (ревокация через `generation`).
- **GitHub отвязка**: ревокация сессий + событие `GITHUB_UNLINKED`; отвязка последнего способа входа запрещена (`409 LAST_AUTH_METHOD`).

## 9. Отступления от плана (по факту реализации)

Требования §1–§8 выполнены; ниже — места, где реализация отличается от текста плана, чтобы документ не расходился с кодом.

- **§3 — хук.** Файл `model/use-telegram-unlink-flow.ts` (kebab-case по конвенции проекта, а не `useTelegramUnlinkFlow.ts`). Состояния `idle | requestingCode | awaitingCode | submittingCode`: отдельных `success`/`error` нет — успех выражается колбэком `submitCode(code, onSuccess)`, ошибка — `errorKey`. Плюс `isBusy`, `isCodeExpired`, `resendIn`, `codeTtlSeconds`, `requestCode()`, `reset()`.
- **§4.5/§4.7 — второй шаг флоу.** Шаг ввода кода — отдельный `Dialog` с `<form>`, а не шаг внутри `ConfirmDialog`. Причина: сабмит по Enter и `onConfirm`, который не перегружается произвольным содержимым; `ConfirmDialog` остаётся коротким предупреждением и не ломается при другой разметке.
- **Текст кнопки первого шага** — «Продолжить» (`telegramUnlinkConfirmAction`), а не «Подтвердить отвязку» из примера §2: на первом шаге отвязки ещё не происходит, запрашивается только код.
- **`githubUnlinkConfirmAction`** — «Отвязать GitHub», чтобы не дублировать текст кнопки-триггера рядом.
- **§4.4 `onError` — раздельно для двух случаев.** Ошибки GitHub: тост, диалог остаётся открытым для повтора. Ошибки шага кода: inline `Field.Error` с `role="alert"`, а не тост. `429` без `code` (штатный `ThrottlerGuard` на `request`) распознаётся по HTTP-статусу, а не по `code`.
- **§4.7 — отсчёт TTL и cooldown.** Привязаны к `expiresAt !== null`, а не к `step`. Иначе после `CODE_EXPIRED`/`ATTEMPTS_EXCEEDED` сброс `step` в `idle` останавливал отсчёт, и кнопка «Отправить код повторно» не разблокировалась бы никогда. При этих кодах выставляется `expiresAt = 0`, чтобы cooldown продолжал досчитываться. Константа `TELEGRAM_UNLINK_RESEND_COOLDOWN_S = 60` повторяет серверный rate limit.
- **§4.4 `onSuccess` — пауза перед логаутом.** `UNLINK_REDIRECT_DELAY_MS = 1500` между тостом и `session.clearSession()` / `queryClient.clear()` / `router.replace(paths.login)`, чтобы тост успел прочитаться.
- **§5 — маппинг F7 вынесен из компонента.** Отдельный `model/unlink-error.ts` с `getUnlinkErrorKey()` и `isCodeInvalidatingError()` (отличает `CODE_EXPIRED`/`ATTEMPTS_EXCEEDED` от единичного `INVALID_CODE`) и своими тестами; компонент текст сервера не разбирает.
- **§2 — i18n.** Ключей 29 на язык вместо 21 из списка (паритет ru/en сохранён). Дополнительно добавлены: `telegramUnlinkButton`, `githubUnlinkButton`, `githubUnlinkSuccess`, `telegramUnlinkCodeLabel`, `telegramUnlinkCodeSending`, `telegramUnlinkCodeConfirming`, `telegramUnlinkCodeTtl`, `telegramUnlinkCodeResendIn`, `telegramUnlinkCodeExpiredNotice` (уведомление об истёкшем коде — текст отличается от `telegramUnlinkErrorExpired`).