# План реализации: безопасная отвязка аккаунтов по ADR-005 (features/update-profile)

## Статус

Не реализовано (заблокировано backend-эндпоинтами ADR-005).

Принятые решения: [backend-спека, §1.1](../../../../backend/specs/security-unlink-adr-005-spec.md) (D1–D14) и [«зонтичная» фронт-спека, §3.1](./security-unlink-adr-005-spec.md) (F1–F7). План ниже учитывает их.

## Цель плана

Пошагово реализовать фронтовую часть безопасной отвязки Telegram/GitHub после появления backend-флоу по [ADR-005](../../../../../docs/adr/ADR-005.md), подключив `ConfirmDialog` в `ConnectedAccountsSection` и реализовав UI-флоу подтверждения отвязки Telegram одноразовым кодом из Telegram.

## Зависимости

- **Backend (критично)**: наличие user-facing эндпоинтов отвязки по ADR-005 — [backend-спека](../../../../backend/specs/security-unlink-adr-005-spec.md), [backend-план](../../../../backend/specs/security-unlink-adr-005-plan.md). После их появления — регенерация OpenAPI → Orval → `@packages/api` (появятся хуки мутаций).
- **Существующий примитив**: `@packages/ui/src/components/ConfirmDialog` — готов к использованию.
- **i18n**: добавление ключей в `packages/i18n/src/locales/{ru,en}/common.json`.
- **Текущая реализация**: `apps/web/src/features/update-profile/ui/ConnectedAccountsSection.tsx`.

## 1. Исследование и подготовка (до кодинга)

- [ ] Ознакомиться с зафиксированным контрактом эндпоинтов отвязки ([backend-спека, §1.1](../../../../backend/specs/security-unlink-adr-005-spec.md), решение D4): пути, тела, статусы. Сверить с актуальным OpenAPI после backend-работ ([backend-план](../../../../backend/specs/security-unlink-adr-005-plan.md)).
- [ ] Проверить наличие сгенерированных хуков в `@packages/api` (для `POST /profile/me/telegram/unlink/request|confirm`, `POST /profile/me/github/unlink`). Если отсутствуют — зафиксировать требование к регенерации API.
- [ ] Учесть, что `PATCH /profile/me` больше не отвязывает (D2/F1): «запасного» пути через `updateProfileMutation` не будет, старую ветку нужно удалить, а не оставить как fallback.
- [ ] Свериться с текстами из ADR-005 и задачей №7 (см. источники).

## 2. i18n (packages/i18n)

Путь: `packages/i18n/src/locales/{ru,en}/common.json`

Добавить недостающие ключи (минимальный набор под целевой флоу):

### ru/common.json
- [ ] `profile.telegramUnlinkConfirmTitle` — заголовок диалога отвязки Telegram
- [ ] `profile.telegramUnlinkConfirmDesc` — описание с предупреждением о ревокации сессий
- [ ] `profile.telegramUnlinkConfirmAction` — текст кнопки подтверждения (например, «Подтвердить отвязку»)
- [ ] `profile.githubUnlinkConfirmTitle`
- [ ] `profile.githubUnlinkConfirmDesc`
- [ ] `profile.githubUnlinkConfirmAction`
- [ ] `profile.telegramUnlinkCodeTitle` — заголовок шага ввода кода (если используется)
- [ ] `profile.telegramUnlinkCodeDesc` — инструкция (одноразовый код из Telegram, TTL)
- [ ] `profile.telegramUnlinkCodePlaceholder` — плейсхолдер поля кода
- [ ] `profile.telegramUnlinkCodeSubmit` — кнопка отправки кода
- [ ] `profile.telegramUnlinkCodeResend` — «Отправить код повторно» (при наличии)
- [ ] `profile.telegramUnlinkErrorExpired` — ошибка истечения TTL
- [ ] `profile.telegramUnlinkErrorInvalidCode` — неверный код
- [ ] `profile.telegramUnlinkErrorAttempts` — превышен лимит попыток (D5)
- [ ] `profile.telegramUnlinkErrorAlreadyUnlinked` — аккаунт уже отвязан (D4)
- [ ] `profile.telegramUnlinkErrorRateLimited` — слишком частые запросы кода (D5, 429)
- [ ] `profile.telegramUnlinkErrorGeneric` — общая ошибка отвязки Telegram
- [ ] `profile.telegramUnlinkSuccess` — тост об успешной отвязке
- [ ] `profile.githubUnlinkErrorLastMethod` — нельзя отвязать последний способ входа (D9, `LAST_AUTH_METHOD`)
- [ ] `profile.githubUnlinkErrorGeneric`

### en/common.json
- [ ] Аналогичные ключи с корректными переводами.

> Контракт ошибок зафиксирован маппингом F7; ключи для каждого кода обязательны (кроме generic). Тексты предупреждений обязательны.

## 3. Модель состояния флоу отвязки Telegram (при необходимости)

Путь: `apps/web/src/features/update-profile/model/`

При реализации многошагового флоу (запрос кода → ввод кода → подтверждение) имеет смысл вынести состояние в отдельный хук/модуль, чтобы не раздувать компонент.

Варианты:

- [ ] Создать `useTelegramUnlinkFlow.ts` (хук) с состояниями: `idle | requestingCode | awaitingCode | submittingCode | success | error` и методами `start()`, `requestCode()`, `submitCode(code)`, `cancel()` (ответ `request` содержит `expiresAt` — хранить для отсчёта и повторной отправки с cooldown).
- [ ] Либо хранить локальное состояние в компоненте через `useReducer` (минимум). Предпочтение — чистый хук в `model/` по FSD.

**Критерий**: контракт зафиксирован (D4/D5); состояние должно покрывать `request` → `awaitingCode` → `confirm` без перестройки компонента.

## 4. Правка `ConnectedAccountsSection.tsx`

Путь: `apps/web/src/features/update-profile/ui/ConnectedAccountsSection.tsx`

### 4.1. Импорты

- [ ] Добавить импорт `ConfirmDialog` из `@packages/ui`:
  ```ts
  import { ConfirmDialog, ... } from "@packages/ui";
  ```

- [ ] Импортировать хуки мутаций отвязки из `@packages/api` (после их появления). Если имена неизвестны на момент старта — временно не подключать конкретные хуки, а описать TODO с ссылкой на регенерацию API. **Главное** — не использовать `useUpdateProfile` для операции отвязки: сервер её больше не принимает (D2), старую ветку `updateProfileMutation.mutate({ data: { telegramUsername: null } })`/`{ gitUrl: null }` **удалить**.

- [ ] Импорт `useState` (уже есть) для управления состоянием диалогов.

### 4.2. Состояния

- [ ] `isTelegramUnlinkConfirmOpen` (boolean)
- [ ] `isGithubUnlinkConfirmOpen` (boolean)
- [ ] При реализации флоу Telegram-кода: `telegramUnlinkStep`, `telegramUnlinkCode`, `telegramUnlinkError`, `isRequestingCode`, `isSubmittingCode`, `expiresAt` и др. (зависят от контракта).

### 4.3. Мутации отвязки

- [ ] Заменить прямые вызовы `updateProfileMutation.mutate({ data: { telegramUsername: null } })` и `{ gitUrl: null }` на вызов специализированных мутаций отвязки; старую ветку удалить (не оставлять как fallback — D2/F1).
- [ ] Объединить `isPending` с pending-состоянием новых мутаций: `const isPending = telegramUnlinkRequestMutation?.isPending || telegramUnlinkConfirmMutation?.isPending || githubUnlinkMutation?.isPending || linkTelegramFlowState === "linking"`. Учесть, что привязка Telegram на актуальном `dev` — deep-link token flow (виджет удалён, `useAuthControllerTelegramLink`/`linkTelegramMutation` больше не актуален).

### 4.4. Обработчики

- [ ] `handleOpenTelegramUnlinkConfirm()` — открыть диалог подтверждения (не вызывать мутацию).
- [ ] `handleConfirmTelegramUnlink()` — запросить код (`POST /profile/me/telegram/unlink/request`), перейти к шагу ввода кода (F3).
- [ ] `handleOpenGithubUnlinkConfirm()` — открыть диалог подтверждения.
- [ ] `handleConfirmGithubUnlink()` — выполнить отвязку GitHub (`POST /profile/me/github/unlink`).
- [ ] `onSuccess` для отвязки (общий): показать тост успеха, `queryClient.invalidateQueries({ queryKey: getProfileControllerGetMyProfileQueryKey() })`, закрыть диалоги, сбросить состояние флоу и **выполнить логаут** с переходом на `paths.login` (F4; паттерн `ChangePasswordSection.tsx`). Без логаута UI останется «залогиненным» с уже отозванной сессией.
- [ ] `onError` для отвязки: показать тост/сообщение ошибки (по маппингу F7), **не закрывать** диалог шага ввода кода, сохранить состояние для повтора.

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

- [ ] Кнопка «Отвязать Telegram» (`profile.telegramUnlinkButton`) — по клику открывает диалог подтверждения (`handleOpenTelegramUnlinkConfirm`), **не** вызывает мутацию отвязки напрямую.
- [ ] Кнопка «Отвязать GitHub» (`profile.githubUnlinkButton`) — аналогично открывает диалог подтверждения.

Существующий код кнопок (блоки 246-272, 312-335 в текущем файле) — изменить только `onClick`.

### 4.7. Telegram: многошаговый флоу кода (целевой)

- [ ] При подтверждении в первом диалоге — запросить код (`POST /profile/me/telegram/unlink/request`); ответ `{ sent: true, expiresAt }` (D4).
- [ ] Открыть/показать второй диалог/экран с полем ввода кода, инструкцией (`profile.telegramUnlinkCodeDesc`) и обратным отсчётом до `expiresAt`.
- [ ] По сабмиту кода — вызвать `POST /profile/me/telegram/unlink/confirm` с телом **только** `{ code }` (F3).
- [ ] Кнопка «Отправить код повторно» — повторный `request` с cooldown (серверный rate limit 1/60с, D5); по возможности блокировать до истечения cooldown.
- [ ] Обработка ошибок по маппингу F7: `INVALID_CODE`, `CODE_EXPIRED` (410), `ATTEMPTS_EXCEEDED` (429), `ALREADY_UNLINKED` (409), `TOO_MANY_REQUESTS` (429) — показать соответствующее сообщение, позволить исправить код или запросить заново.
- [ ] По успеху — закрыть все диалоги, инвалидировать кэш, тост успеха, логаут (F4).

**Важно:** не хардкодить тексты, использовать только ключи i18n; не логировать и не отображать код вне поля ввода.

## 5. Тесты

Путь: `apps/web/src/features/update-profile/ui/ConnectedAccountsSection.test.tsx`

Создать/обновить unit-тесты с использованием `@testing-library/react` + `vitest`.

> **Важно (существующие тесты).** Сейчас `ConnectedAccountsSection.test.tsx` содержит кейсы, проверяющие **немедленную** отвязку по клику (`вызывает отвязку Telegram/GitHub при клике на соответствующую кнопку`) — они опираются на текущий `PATCH /profile/me`-флоу и должны быть переписаны под «клик → диалог → подтверждение».

### Обязательные кейсы

- [ ] **Открытие диалога Telegram**: клик «Отвязать Telegram» открывает `ConfirmDialog` с корректным заголовком/описанием.
- [ ] **Отмена Telegram**: клик «Отмена» в диалоге **не** вызывает мутацию отвязки, диалог закрывается (`onOpenChange(false)`).
- [ ] **Подтверждение Telegram**: клик «Подтвердить отвязку» вызывает **корректную** мутацию запроса кода (не `updateProfile` с `telegramUsername: null`).
- [ ] **Успех Telegram**: при успешной мутации — тост успеха, инвалидация кэша профиля, закрытие диалогов, логаут/переход на `paths.login`.
- [ ] **Ошибка Telegram**: при ошибке мутации — тост/сообщение ошибки, **диалог остаётся открытым**.
- [ ] **Блокировка во время pending**: при `isPending` кнопки «Отмена» и «Подтвердить отвязку» дизейблятся, закрытие по Esc/оверлею игнорируется (поведение `ConfirmDialog`).
- [ ] **GitHub — аналогичные**: открытие, отмена, подтверждение, успех, ошибка; отдельно — `409 LAST_AUTH_METHOD` показывает сообщение и не закрывает диалог.
- [ ] **Ветка PATCH удалена**: нет тестов/кода, вызывающих `updateProfile` с `telegramUsername: null` / `gitUrl: null` (F1).
- [ ] **Привязка Telegram не регрессирует**: актуальный deep-link flow привязки продолжает работать (существующие тесты не регрессят; виджет-тестов быть не должно).

### Тестирование флоу кода

- [ ] После `request` отображается шаг ввода кода с отсчётом до `expiresAt`.
- [ ] Сабмит с валидным кодом вызывает мутацию подтверждения с телом `{ code }`.
- [ ] Ошибки `INVALID_CODE`/`CODE_EXPIRED`/`ATTEMPTS_EXCEEDED` отображаются корректно, диалог не закрывается.
- [ ] Кнопка «Отправить код повторно» перезапрашивает код (с учётом cooldown/429).

### Мокирование

- [ ] Мокировать `@tanstack/react-query` (`useQueryClient`), `react-i18next`, `@packages/ui` хуки (`useToast`) при необходимости.
- [ ] Мокировать хуки из `@packages/api` (новые хуки отвязки + существующие).
- [ ] Для тестов шага ввода кода при необходимости использовать fake timers (`vi.useFakeTimers()`) из-за обратного отсчёта до `expiresAt` и cooldown повторной отправки; не забыть `vi.useRealTimers()`.

## 6. Проверки качества

### Линтер/типизация/тесты

- [ ] `pnpm --filter web exec tsc --noEmit` — без ошибок TypeScript.
- [ ] `pnpm --filter web exec vitest run` — все тесты проходят (в т.ч. новые).
- [ ] Проверка отсутствия прямых импортов дат в изменённых файлах (правило из shared-spec) — применимо, но изменения в `ConnectedAccountsSection` не затрагивают работу с датой.
- [ ] Проверка консистентности с FSD (изменения в рамках `features/update-profile`).

### Ручная проверка (после появления backend)

- [ ] Отвязка Telegram: диалог открывается, предупреждение корректное, после подтверждения сессии ревокируются, включая текущую (переход на логин).
- [ ] Отвязка GitHub: аналогично; отвязка последнего способа входа отклоняется с понятным сообщением.
- [ ] Telegram-кодовый флоу: запрос кода → ввод кода → успешная отвязка.
- [ ] Ошибки (TTL истёк, код неверный, лимит попыток, rate limit) корректно обрабатываются, UI остаётся предсказуемым.
- [ ] Тосты отображаются корректно, кэш профиля инвалидируется.

## 7. DoD по плану

- [ ] Все пункты 1–6 выполнены.
- [ ] Изменения соответствуют [«зонтичной» спеке](./security-unlink-adr-005-spec.md) (§3.1), [UI-флоу спеке](./security-unlink-frontend-spec.md) (§3.1) и [backend-спеке, §1.1](../../../../backend/specs/security-unlink-adr-005-spec.md).
- [ ] Код ревью пройден (соответствие правилам AGENTS.md).
- [ ] Нет регрессий в существующем функционале (привязка Telegram deep-link token flow, привязка GitHub OAuth).
- [ ] Ветка отвязки через `updateProfileMutation` удалена (F1); по успеху выполняется логаут (F4).

## 8. Примечания

- **Контракт зафиксирован** (D4/D5): пути, `{ code }` без токена, статусы ошибок. Абстракция хука нужна только до регенерации `@packages/api`.
- **`PATCH /profile/me` больше не отвязывает** (D2): старую ветку удалить, а не сохранять как «обратную совместимость».
- **Привязка Telegram** на актуальном `dev` — deep-link token flow; виджет и `linkTelegramMutation` неактуальны. Привязка сама отзывает остальные сессии (D3) — тексты рядом с привязкой должны это учитывать.
- **Логаут после успеха обязателен**: `generation` отзывает и текущую сессию (F4).
- **Точный текст предупреждения**: не давать ложных гарантий — указывать завершение всех сессий, включая текущую, со ссылкой на суть (ревокация через `generation`).
- **GitHub отвязка**: ревокация сессий + событие `GITHUB_UNLINKED`; отвязка последнего способа входа запрещена (`409 LAST_AUTH_METHOD`).