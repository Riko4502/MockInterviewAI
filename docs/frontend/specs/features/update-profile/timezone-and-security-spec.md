# Спецификация: таймзона в профиле и безопасная отвязка аккаунтов (features/update-profile)

## 1. Цель

Интегрировать выбор IANA-таймзоны в `GeneralTab` и добавить валидацию поля `timezone`.
Подготовить почву для безопасной отвязки Telegram/GitHub после backend ADR-005 (см. §3 и [security-unlink-adr-005-spec.md](./security-unlink-adr-005-spec.md)).

## 2. Таймзона в профиле — ✅ реализовано

| Файл | Тип | Описание |
|---|---|---|
| `features/update-profile/model/profile-form-schema.ts` | EDIT | Добавлен `timezone: z.string().trim().min(1)` + двухшаговая IANA-валидация через `isValidTimeZone` из `@packages/utils`. `toUpdateProfileDto` отправляет `timezone` с учётом `dirtyFields`. |
| `features/update-profile/ui/GeneralTab.tsx` | EDIT | Добавлено поле `timezone` (Controller + `TimezoneSelect`), `defaultValues`/`reset` берут `user.timezone`. |
| `packages/i18n/src/locales/{ru,en}/common.json` | EDIT | Ключи `profile.timezone`, `profile.timezoneHelp`, `profile.errors.timezone`. |

Правила: IANA-таймзона, двухшаговая валидация (по спецификации shared). Использован `TimezoneSelect` из `entities/user`.

> **Предпосылка [B]** закрыта: `PATCH /profile/me` сохраняет `timezone`, `GET /profile/me` возвращает его.

## 3. Безопасная отвязка аккаунтов (ADR-005)

Реализация фронтенда безопасной отвязки планируется согласно
[ADR-005](../../../adr/ADR-005.md). Детали и чек-листы — в
[плане реализации](./security-unlink-adr-005-plan.md).

Требования (ADR-005):
1) подтверждение отвязки Telegram **одноразовым кодом из Telegram** и
отдельный user-facing эндпоинт (не `PATCH /profile/me`);
2) **ревокации сессий** (инкремент `generation`) при отвязке;
3) отдельные эндпоинты отвязки Telegram/GitHub;
4) предупреждающие `ConfirmDialog` для Telegram/GitHub;
5) события безопасности `TG_UNLINKED`, `GITHUB_UNLINKED`.

Текущая веб-реализация использует `PATCH /profile/me` с `telegramUsername: null` / `gitUrl: null`
([ConnectedAccountsSection.tsx:119-151](../../../../apps/web/src/features/update-profile/ui/ConnectedAccountsSection.tsx#L119-L151));
после внедрения backend-флоу ADR-005 она должна быть заменена на отдельные эндпоинты
отвязки из `@packages/api`.

| Файл | Тип | Статус |
|---|---|---|
| `features/update-profile/ui/ConnectedAccountsSection.tsx` | EDIT | По [плану](./security-unlink-adr-005-plan.md) — добавить состояния диалогов, подключить `ConfirmDialog`, использовать новые эндпоинты отвязки, реализовать флоу с кодом Telegram |
| `packages/ui/src/components/ConfirmDialog` | EXISTS | Общий `ConfirmDialog` используется в соответствии с [планом](./security-unlink-adr-005-plan.md) |

Поведение (реализация по [плану](./security-unlink-adr-005-plan.md)):
- Предупреждающий `ConfirmDialog` перед вызовом мутации (Telegram/GitHub).
- Кнопки: «Отмена», «Подтвердить отвязку» (с корректными лейблами i18n).
- Использование **отдельных эндпоинтов отвязки** из `@packages/api` (не `PATCH /profile/me`).
- Подтверждение одноразовым кодом из Telegram (UI-флоу, ADR-005).

## 4. i18n

- Лейбл/подсказка поля в `GeneralTab` (namespace `common`): `profile.timezone`, `profile.timezoneHelp`. Ошибка: `profile.errors.timezone`.
- Внутри `TimezoneSelect` (namespace `showcase`): `profile.timezone`, `profile.detectTimezone`, `profile.timezoneHelp`, поиск/пусто.

## 5. Тест-кейсы

- [x] Сохранение `timezone` в профиле (`UpdateProfileForm.test.tsx`, `profile-form-schema.test.ts`)
- [x] Автодетект в `TimezoneSelect` работает (существующие тесты `TimezoneSelect`)
- [ ] Клик «Отвязать Telegram» открывает ConfirmDialog, отмена не вызывает мутацию (см. [план](./security-unlink-adr-005-plan.md))
- [ ] Подтверждение диалога инициирует флоу подтверждения кодом из Telegram и вызывает мутацию отвязки через отдельный эндпоинт (см. [план](./security-unlink-adr-005-plan.md))
- [ ] Аналогично для GitHub — открытие ConfirmDialog, подтверждение вызывает мутацию через отдельный эндпоинт (см. [план](./security-unlink-adr-005-plan.md))

## 6. Связи

- `entities/user/ui/TimezoneSelect`
- `@packages/utils` (`isValidTimeZone`)
- `@packages/ui` — общий `ConfirmDialog` (`packages/ui/src/components/ConfirmDialog`)
- `@packages/i18n`
- `@packages/api`
- [security-unlink-adr-005-spec.md](./security-unlink-adr-005-spec.md)
- [security-unlink-adr-005-plan.md](./security-unlink-adr-005-plan.md)
