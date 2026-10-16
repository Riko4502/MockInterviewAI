# План реализации: таймзона в профиле и безопасная отвязка аккаунтов

> Зависит от [0] shared и [1] timezone. Backend-предпосылка [B] закрыта:
> `PATCH /profile/me` сохраняет `timezone`, `GET /profile/me` возвращает его.

## Статус

- Таймзона в профиле — ✅ реализовано.
- Подтверждающие диалоги отвязки Telegram/GitHub — ⛔ **отложены** до
  реализации backend ADR-005 (см. §3). Общий `ConfirmDialog` создан в
  `@packages/ui`, но **не подключён**.

## 1. `profile-form-schema.ts` (EDIT) — ✅
Путь: `apps/web/src/features/update-profile/model/profile-form-schema.ts`

- [x] Добавить `timezone: z.string().min(1)` в **форму профиля на фронте** (двухшаговая IANA-валидация через `isValidTimeZone` из `@packages/utils`, которая выполняет `isIanaTimeZoneFormat` + `isResolvableTimeZone`). На бэкенде запросная схема `updateProfileSchema` **уже** валидирует `timezone` — на сервере добавлять не нужно.
- [x] Локализованный ключ ошибки `profile.errors.timezone`.
- [x] `toUpdateProfileDto` отправляет `timezone` (с учётом `dirtyFields`).

## 2. `GeneralTab.tsx` (EDIT) — ✅
Путь: `apps/web/src/features/update-profile/ui/GeneralTab.tsx`

- [x] Импорт `TimezoneSelect` из `entities/user`
- [x] Добавить контролируемое поле `timezone` (через `Controller`)
- [x] Отправка в `useUpdateProfile`
- [x] `defaultValues`/`reset` берут `user.timezone`
- [x] i18n-ключи `profile.timezone`, `profile.timezoneHelp` в `common.json` (RU/EN)

## 3. `ConnectedAccountsSection.tsx` (EDIT) — ⛔ отложено
Путь: `apps/web/src/features/update-profile/ui/ConnectedAccountsSection.tsx`

Причина: ADR-005 явно требует подтверждения отвязки Telegram **кодом из
Telegram** и **ревокации сессий** (инкремент `generation`) на отдельном
user-facing эндпоинте. Сегодня ничего из этого нет:

- статус ADR-005 — «Не реализовано»;
- веб-отвязка идёт через `PATCH /profile/me` с `telegramUsername: null` /
  `gitUrl: null` (`apps/api/src/modules/users/users.service.ts:462-487`),
  при этом `generation` **не** инкрементируется, сессии **не** ревокируются;
- user-facing эндпоинтов отвязки в `@packages/api` нет.

Диалог с текстом «все остальные активные сессии … будут принудительно
завершены» давал бы ложную гарантию безопасности.

Пункты (не выполняются до backend-работы по ADR-005):
- [~] Состояния `isTelegramUnlinkDialogOpen`, `isGithubUnlinkDialogOpen`
- [~] По клику на «Отвязать Telegram» — открыть диалог (не вызывать мутацию)
- [~] По клику на «Отвязать GitHub» — открыть диалог
- [~] ConfirmDialog с предупреждением (ADR-005)
- [~] On confirm — закрыть диалог, вызвать мутацию отвязки
- [~] Обработка loading, успех/ошибка (toasts)

При этом общий `ConfirmDialog` уже добавлен в `@packages/ui`
(`packages/ui/src/components/ConfirmDialog`) с unit-тестами — переиспользуемый
примитив готов, остаётся подключение после появления корректного backend-флоу.

## 4. Тесты
- [x] `profile-form-schema.test.ts` — валидация `timezone` и `toUpdateProfileDto`
- [x] `UpdateProfileForm.test.tsx` — сохранение выбранной таймзоны
- [~] Unit-тесты на подтверждение отвязки — отложены вместе с §3
- [x] `packages/ui` `ConfirmDialog.test.tsx`

## 5. Проверки
- [x] tsc без ошибок
- [x] i18n ключи
