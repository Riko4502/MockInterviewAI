# Спецификация: таймзона в профиле и безопасная отвязка аккаунтов (features/update-profile)

## 1. Цель

Интегрировать выбор IANA-таймзоны в `GeneralTab`, добавить валидацию поля `timezone` и реализовать **предупреждающие диалоги безопасности** при отвязке Telegram/GitHub (ADR-005).

## 2. Таймзона в профиле

| Файл | Тип | Описание |
|---|---|---|
| `features/update-profile/model/profile-form-schema.ts` | EDIT | Добавить `timezone: z.string().min(1)`. По желанию клиентская двухшаговая валидация (`isIanaTimeZoneFormat` + `isResolvableTimeZone`) из `@packages/utils`. |
| `features/update-profile/ui/GeneralTab.tsx` | EDIT | Добавить поле `timezone`, подключить `TimezoneSelect`. Отправка в `useUpdateProfile`. |

Правила: IANA-таймзона, двухшаговая валидация (по спецификации shared). Использовать `TimezoneSelect` из `entities/user/ui`.

## 3. Безопасная отвязка аккаунтов (ADR-005)

| Файл | Тип | Описание |
|---|---|---|
| `features/update-profile/ui/ConnectedAccountsSection.tsx` | EDIT | При клике «Отвязать Telegram»/«Отвязать GitHub» — сначала открыть `ConfirmDialog`. Только после подтверждения вызывать мутацию отвязки. |

Текст предупреждения:
> «Внимание: при отвязке аккаунта все остальные активные сессии на других устройствах будут принудительно завершены в целях безопасности»

Поведение:
- Диалог открытия до вызова мутации.
- Кнопки: «Отмена», «Подтвердить отвязку».
- Приоритет — использовать эндпоинты отвязки из `@packages/api` (если есть). Иначе временно `updateProfile` с null-полями **только после подтверждения**.
- Задел на будущее (ADR-005): предусмотреть состояние для показа диалога ввода одноразового кода подтверждения Telegram (UI-плейсхолдер, без реализации логики).

## 4. i18n

Ключи: `profile.timezone`, `profile.detectTimezone`, `profile.timezoneHelp` (из namespace `showcase`).

## 5. Тест-кейсы

- [ ] Сохранение `timezone` в профиле
- [ ] Автодетект в `TimezoneSelect` работает
- [ ] Клик «Отвязать Telegram» открывает ConfirmDialog, отмена не вызывает мутацию
- [ ] Подтверждение диалога вызывает мутацию отвязки
- [ ] Аналогично для GitHub

## 6. Связи

- `entities/user/ui/TimezoneSelect`
- `@packages/utils/datetime` (валидация IANA при желании)
- `@packages/ui` (ConfirmDialog)
- `@packages/i18n`
- `@packages/api`
