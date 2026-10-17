# План реализации: безопасная отвязка аккаунтов по ADR-005 (features/update-profile)

## Статус

Не реализовано.

## Цель плана

Пошагово реализовать фронтовую часть безопасной отвязки Telegram/GitHub после появления backend-флоу по [ADR-005](../../../../../docs/adr/ADR-005.md), подключив `ConfirmDialog` в `ConnectedAccountsSection` и реализовав UI-флоу подтверждения отвязки Telegram одноразовым кодом из Telegram.

## Зависимости

- **Backend (критично)**: наличие user-facing эндпоинтов отвязки по ADR-005 — [backend-спека](../../../../backend/specs/security-unlink-adr-005-spec.md), [backend-план](../../../../backend/specs/security-unlink-adr-005-plan.md). После их появления — регенерация OpenAPI → Orval → `@packages/api` (появятся хуки мутаций).
- **Существующий примитив**: `@packages/ui/src/components/ConfirmDialog` — готов к использованию.
- **i18n**: добавление ключей в `packages/i18n/src/locales/{ru,en}/common.json`.
- **Текущая реализация**: `apps/web/src/features/update-profile/ui/ConnectedAccountsSection.tsx`.

## 1. Исследование и подготовка (до кодинга)

- [ ] Ознакомиться с актуальным OpenAPI (после backend-работ по ADR-005) на предмет эндпоинтов отвязки (Telegram/GitHub). Зафиксировать имена путей, тела запросов/ответов, возможные статусы ошибок. Backend-контракт работ — [backend-план](../../../../backend/specs/security-unlink-adr-005-plan.md).
- [ ] Проверить наличие сгенерированных хуков в `@packages/api` (например, `useAuthController*Unlink*` или аналогичные). Если отсутствуют — зафиксировать требование к регенерации API.
- [ ] Уточнить контракт флоу подтверждения отвязки Telegram кодом (одноразовый токен с TTL: как запрашивается токен, как передаётся код, формат ответа).
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
- [ ] `profile.telegramUnlinkErrorGeneric` — общая ошибка отвязки

### en/common.json
- [ ] Аналогичные ключи с корректными переводами.

> Примечание: при финальном контракте backend список ключей может быть скорректирован, но базовые (диалоги + предупреждение) обязательны.

## 3. Модель состояния флоу отвязки Telegram (при необходимости)

Путь: `apps/web/src/features/update-profile/model/`

При реализации многошагового флоу (запрос токена → ввод кода → подтверждение) имеет смысл вынести состояние в отдельный хук/модуль, чтобы не раздувать компонент.

Варианты:

- [ ] Создать `useTelegramUnlinkFlow.ts` (хук) с состояниями: `idle | requestingToken | awaitingCode | confirming | success | error` и методами `start()`, `requestToken()`, `submitCode(code)`, `cancel()`.
- [ ] Либо хранить локальное состояние в компоненте через `useReducer` (минимум). Предпочтение — чистый хук в `model/` по FSD.

**Критерий**: расширяемость под финальный контракт API без кардинальной перестройки компонента.

## 4. Правка `ConnectedAccountsSection.tsx`

Путь: `apps/web/src/features/update-profile/ui/ConnectedAccountsSection.tsx`

### 4.1. Импорты

- [ ] Добавить импорт `ConfirmDialog` из `@packages/ui`:
  ```ts
  import { ConfirmDialog, ... } from "@packages/ui";
  ```

- [ ] Импортировать хуки мутаций отвязки из `@packages/api` (после их появления). Если имена неизвестны на момент старта — временно не подключать конкретные хуки, а описать TODO с ссылкой на регенерацию API. **Главное** — не использовать `useUpdateProfile` для самой операции отвязки при наличии специализированных эндпоинтов.

- [ ] Импорт `useState` (уже есть) для управления состоянием диалогов.

### 4.2. Состояния

- [ ] `isTelegramUnlinkConfirmOpen` (boolean)
- [ ] `isGithubUnlinkConfirmOpen` (boolean)
- [ ] При реализации флоу Telegram-кода: `telegramUnlinkStep`, `telegramUnlinkCode`, `telegramUnlinkError`, `isRequestingToken`, `isSubmittingCode` и др. (зависят от контракта).

### 4.3. Мутации отвязки

- [ ] Заменить прямые вызовы `updateProfileMutation.mutate({ data: { telegramUsername: null } })` и `{ gitUrl: null }` на вызов специализированных мутаций отвязки.
- [ ] Объединить `isPending` с pending-состоянием новых мутаций: `const isPending = linkTelegramMutation.isPending || updateProfileMutation.isPending || telegramUnlinkMutation?.isPending || githubUnlinkMutation?.isPending`.

### 4.4. Обработчики

- [ ] `handleOpenTelegramUnlinkConfirm()` — открыть диалог подтверждения (не вызывать мутацию).
- [ ] `handleConfirmTelegramUnlink()` — выполнить запрос отвязки по корректному эндпоинту. При многошаговом флоу — первый шаг (запрос токена) либо сразу подтверждение в зависимости от дизайна.
- [ ] `handleOpenGithubUnlinkConfirm()` — открыть диалог подтверждения.
- [ ] `handleConfirmGithubUnlink()` — выполнить отвязку GitHub по корректному эндпоинту.
- [ ] `onSuccess` для отвязки: показать тост успеха, `queryClient.invalidateQueries({ queryKey: getProfileControllerGetMyProfileQueryKey() })`, закрыть соответствующий диалог, сбросить состояние флоу.
- [ ] `onError` для отвязки: показать тост ошибки (использовать ключи из i18n при наличии), **не закрывать** диалог, сохранить состояние для повтора.

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
  cancelLabel={t("profile.cancel", { defaultValue: "Отмена" })}
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
  cancelLabel={t("profile.cancel", { defaultValue: "Отмена" })}
  confirmVariant="destructive"
  isPending={isGithubUnlinkBusy}
  onConfirm={handleConfirmGithubUnlink}
/>
```

**Текст предупреждения**: в `description` должен явно упоминаться факт принудительного завершения остальных активных сессий на других устройствах (ревокация через инкремент `generation`) — в точном соответствии с ADR-005.

### 4.6. UI: кнопки действий

- [ ] Кнопка «Отвязать Telegram» (`profile.telegramUnlinkButton`) — по клику открывает диалог подтверждения (`handleOpenTelegramUnlinkConfirm`), **не** вызывает `handleUnlinkTelegram` напрямую.
- [ ] Кнопка «Отвязать GitHub» (`profile.githubUnlinkButton`) — аналогично открывает диалог подтверждения.

Существующий код кнопок (блоки 246-272, 312-335 в текущем файле) — изменить только `onClick`.

### 4.7. Telegram: многошаговый флоу кода (целевой)

Если backend требует подтверждения кодом из Telegram:

- [ ] При подтверждении в первом диалоге (или сразу после него) — запросить одноразовый токен для отвязки (мутация генерации токена).
- [ ] Открыть/показать второй диалог/экран с полем ввода кода и инструкцией (`profile.telegramUnlinkCodeDesc`).
- [ ] По сабмиту кода — вызвать мутацию подтверждения отвязки с кодом.
- [ ] Обработка ошибок: истёк TTL, неверный код — показать соответствующие сообщения, позволить запросить код повторно.
- [ ] По успеху — закрыть все диалоги, инвалидировать кэш, тост успеха.

**Важно:** не хардкодить тексты, использовать только ключи i18n.

## 5. Тесты

Путь: `apps/web/src/features/update-profile/ui/ConnectedAccountsSection.test.tsx`

Создать/обновить unit-тесты с использованием `@testing-library/react` + `vitest`.

> **Важно (существующие тесты).** Сейчас `ConnectedAccountsSection.test.tsx` содержит кейсы, проверяющие **немедленную** отвязку по клику (`вызывает отвязку Telegram/GitHub при клике на соответствующую кнопку`) — они опираются на текущий `PATCH /profile/me`-флоу и должны быть переписаны под «клик → диалог → подтверждение».

### Обязательные кейсы

- [ ] **Открытие диалога Telegram**: клик «Отвязать Telegram» открывает `ConfirmDialog` с корректным заголовком/описанием.
- [ ] **Отмена Telegram**: клик «Отмена» в диалоге **не** вызывает мутацию отвязки, диалог закрывается (`onOpenChange(false)`).
- [ ] **Подтверждение Telegram**: клик «Подтвердить отвязку» вызывает **корректную** мутацию отвязки (не `updateProfile` с `telegramUsername: null`), если есть специализированный эндпоинт.
- [ ] **Успех Telegram**: при успешной мутации — показывается тост успеха, инвалидируется кэш профиля, диалог закрывается.
- [ ] **Ошибка Telegram**: при ошибке мутации — показывается тост ошибки, **диалог остаётся открытым**.
- [ ] **Блокировка во время pending**: при `isPending` кнопки «Отмена» и «Подтвердить отвязку» дизейблятся, закрытие по Esc/оверлею игнорируется (поведение `ConfirmDialog`).
- [ ] **GitHub — аналогичные**: открытие, отмена, подтверждение, успех, ошибка.
- [ ] **Связь не ломает привязку**: диалог привязки Telegram (виджет) по-прежнему работает (существующие тесты не регрессят).

### Тестирование флоу кода (если реализуется)

- [ ] После запроса токена отображается шаг ввода кода.
- [ ] Сабмит с валидным кодом вызывает мутацию подтверждения.
- [ ] Ошибка «неверный код»/«истёк TTL» отображается корректно.
- [ ] Кнопка «Отправить код повторно» перезапрашивает токен.

### Мокирование

- [ ] Мокировать `@tanstack/react-query` (`useQueryClient`), `react-i18next`, `@packages/ui` хуки (`useToast`) при необходимости.
- [ ] Мокировать хуки из `@packages/api` (новые хуки отвязки + существующие).
- [ ] Фиксировать часы не требуется (кейс не связан с датой/временем).

## 6. Проверки качества

### Линтер/типизация/тесты

- [ ] `pnpm --filter web exec tsc --noEmit` — без ошибок TypeScript.
- [ ] `pnpm --filter web exec vitest run` — все тесты проходят (в т.ч. новые).
- [ ] Проверка отсутствия прямых импортов дат в изменённых файлах (правило из shared-spec) — применимо, но изменения в `ConnectedAccountsSection` не затрагивают работу с датой.
- [ ] Проверка консистентности с FSD (изменения в рамках `features/update-profile`).

### Ручная проверка (после появления backend)

- [ ] Отвязка Telegram: диалог открывается, предупреждение корректное, после подтверждения сессии на других устройствах ревокируются (по поведению backend).
- [ ] Отвязка GitHub: аналогично.
- [ ] Telegram-кодовый флоу: запрос токена → ввод кода → успешная отвязка.
- [ ] Ошибки (TTL истёк, код неверный) корректно обрабатываются, UI остаётся предсказуемым.
- [ ] Тосты отображаются корректно, кэш профиля инвалидируется.

## 7. DoD по плану

- [ ] Все пункты 1–6 выполнены.
- [ ] Изменения соответствуют спецификации [security-unlink-adr-005-spec.md](./security-unlink-adr-005-spec.md) и [security-unlink-frontend-spec.md](./security-unlink-frontend-spec.md).
- [ ] Код ревью пройден (соответствие правилам AGENTS.md).
- [ ] Нет регрессий в существующем функционале (привязка Telegram через виджет, привязка GitHub OAuth).

## 8. Примечания

- **Не форсить backend**: если на момент реализации финальный контракт ещё не готов — реализовать UI с чётким интерфейсом для хука мутации (абстракция), чтобы минимизировать правки при интеграции.
- **Сохранять обратную совместимость**: не удалять существующие обработчики привязки Telegram виджетом (`linkTelegramMutation`) — только блок отвязки.
- **Точный текст предупреждения**: избегать формулировок «все сессии будут завершены сразу» без контекста ревокации; лучше отразить суть безопасности в соответствии с ADR-005.
- **GitHub отвязка**: учесть требование ADR-005 о включении GitHub-отвязки в объём задачи (ревокация сессий + событие).