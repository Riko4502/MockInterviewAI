# План реализации: таймзона в профиле и безопасная отвязка аккаунтов

> Зависит от [0] shared и [1] timezone. Backend-предпосылка [B] закрыта:
> `PATCH /profile/me` сохраняет `timezone`, `GET /profile/me` возвращает его.

## Статус

- Таймзона в профиле — ✅ реализовано.
- Подтверждающие диалоги отвязки Telegram/GitHub — планируются в [security-unlink-adr-005-plan.md](./security-unlink-adr-005-plan.md) (требует backend ADR-005). Общий `ConfirmDialog` создан в `@packages/ui`.

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

## 3. `ConnectedAccountsSection.tsx` (EDIT) — планируется
Путь: `apps/web/src/features/update-profile/ui/ConnectedAccountsSection.tsx`

Подключение `ConfirmDialog` и реализация безопасного флоу отвязки Telegram/GitHub вынесены в отдельный план: [security-unlink-adr-005-plan.md](./security-unlink-adr-005-plan.md).

Причина: ADR-005 требует подтверждения отвязки Telegram **кодом из
Telegram** и **ревокации сессий** (инкремент `generation`) на отдельном
user-facing эндпоинте. Сегодня веб-отвязка идёт через `PATCH /profile/me`
с `telegramUsername: null` / `gitUrl: null`
(`apps/api/src/modules/users/users.service.ts:462-487`), при этом
`generation` **не** инкрементируется, сессии **не** ревокируются;
user-facing эндпоинтов отвязки в `@packages/api` нет.

Общий `ConfirmDialog` уже добавлен в `@packages/ui`
(`packages/ui/src/components/ConfirmDialog`) с unit-тестами — будет подключён
в рамках указанного плана после появления корректного backend-флоу.

## 4. Тесты
- [x] `profile-form-schema.test.ts` — валидация `timezone` и `toUpdateProfileDto`
- [x] `UpdateProfileForm.test.tsx` — сохранение выбранной таймзоны
- [ ] Unit-тесты на подтверждение отвязки — будут добавлены в рамках [security-unlink-adr-005-plan.md](./security-unlink-adr-005-plan.md)
- [x] `packages/ui` `ConfirmDialog.test.tsx`

## 5. Проверки
- [x] tsc без ошибок
- [x] i18n ключи
