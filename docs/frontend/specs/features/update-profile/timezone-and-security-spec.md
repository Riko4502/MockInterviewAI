# Спецификация: таймзона в профиле и безопасная отвязка аккаунтов (features/update-profile)

## 1. Цель

Интегрировать выбор IANA-таймзоны в `GeneralTab` и добавить валидацию поля `timezone`.
Предупреждающие диалоги безопасности при отвязке Telegram/GitHub (ADR-005)
**отложены** до реализации backend ADR-005 (см. §3).

## 2. Таймзона в профиле — ✅ реализовано

| Файл | Тип | Описание |
|---|---|---|
| `features/update-profile/model/profile-form-schema.ts` | EDIT | Добавлен `timezone: z.string().trim().min(1)` + двухшаговая IANA-валидация через `isValidTimeZone` из `@packages/utils`. `toUpdateProfileDto` отправляет `timezone` с учётом `dirtyFields`. |
| `features/update-profile/ui/GeneralTab.tsx` | EDIT | Добавлено поле `timezone` (Controller + `TimezoneSelect`), `defaultValues`/`reset` берут `user.timezone`. |
| `packages/i18n/src/locales/{ru,en}/common.json` | EDIT | Ключи `profile.timezone`, `profile.timezoneHelp`, `profile.errors.timezone`. |

Правила: IANA-таймзона, двухшаговая валидация (по спецификации shared). Использован `TimezoneSelect` из `entities/user`.

> **Предпосылка [B]** закрыта: `PATCH /profile/me` сохраняет `timezone`, `GET /profile/me` возвращает его.

## 3. Безопасная отвязка аккаунтов (ADR-005) — ⛔ отложено

Решение (2026-10-16): **не реализовывать** подтверждающие диалоги, пока не
готов backend-флоу ADR-005.

Обоснование. ADR-005 (статус — «Не реализовано») требует:
1) подтверждения отвязки Telegram **одноразовым кодом из Telegram** и
отдельного user-facing эндпоинта; 2) **ревокации сессий** (инкремент
`generation`) при отвязке.

Сегодня веб-отвязка выполняется через `PATCH /profile/me` с
`telegramUsername: null` / `gitUrl: null`
(`apps/api/src/modules/users/users.service.ts:462-487`); сервер очищает
`telegramId`/`chatId`/`githubId`, но **не** инкрементирует `generation` и
**не** ревокирует сессии. Эндпоинтов отвязки в `@packages/api` нет.

Поэтому текст предупреждения «все остальные активные сессии на других
устройствах будут принудительно завершены» был бы ложной гарантией
безопасности. Подтверждающий шаг без него не даёт реальной защиты, а
требуемое ADR-005 подтверждение кодом всё равно невозможно без backend.

| Файл | Тип | Статус |
|---|---|---|
| `features/update-profile/ui/ConnectedAccountsSection.tsx` | EDIT | ⛔ не изменяется |
| `packages/ui/src/components/ConfirmDialog` | NEW | ✅ общий `ConfirmDialog` создан и протестирован, но **не подключён** |

Поведение (для будущей реализации после backend ADR-005):
- Диалог открытия до вызова мутации.
- Кнопки: «Отмена», «Подтвердить отвязку».
- Использовать эндпоинты отвязки из `@packages/api`.
- Подтверждение одноразовым кодом из Telegram (UI-флоу, ADR-005).

## 4. i18n

- Лейбл/подсказка поля в `GeneralTab` (namespace `common`): `profile.timezone`, `profile.timezoneHelp`. Ошибка: `profile.errors.timezone`.
- Внутри `TimezoneSelect` (namespace `showcase`): `profile.timezone`, `profile.detectTimezone`, `profile.timezoneHelp`, поиск/пусто.

## 5. Тест-кейсы

- [x] Сохранение `timezone` в профиле (`UpdateProfileForm.test.tsx`, `profile-form-schema.test.ts`)
- [x] Автодетект в `TimezoneSelect` работает (существующие тесты `TimezoneSelect`)
- [~] Клик «Отвязать Telegram» открывает ConfirmDialog, отмена не вызывает мутацию — отложено (§3)
- [~] Подтверждение диалога вызывает мутацию отвязки — отложено (§3)
- [~] Аналогично для GitHub — отложено (§3)

## 6. Связи

- `entities/user/ui/TimezoneSelect`
- `@packages/utils` (`isValidTimeZone`)
- `@packages/ui` — общий `ConfirmDialog` создан (`packages/ui/src/components/ConfirmDialog`), но не подключён до backend ADR-005
- `@packages/i18n`
- `@packages/api`
