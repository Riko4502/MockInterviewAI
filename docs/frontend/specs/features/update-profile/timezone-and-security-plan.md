# План реализации: таймзона в профиле и безопасная отвязка аккаунтов

> Зависит от [0] shared и [1] timezone. Сохранение таймзоны требует backend-предпосылки [B]: `PATCH /profile/me` должен сохранять `timezone`, `GET /profile/me` — возвращать его (сейчас игнорируется).

## 1. `profile-form-schema.ts` (EDIT)
Путь: `apps/web/src/features/update-profile/model/profile-form-schema.ts`

- [ ] Добавить `timezone: z.string().min(1)` (двухшаговая IANA-валидация через `isIanaTimeZoneFormat` + `isResolvableTimeZone` из `@packages/utils`)

## 2. `GeneralTab.tsx` (EDIT)
Путь: `apps/web/src/features/update-profile/ui/GeneralTab.tsx`

- [ ] Импорт `TimezoneSelect` из `entities/user/ui`
- [ ] Добавить контролируемое поле `timezone`
- [ ] Отправка в `useUpdateProfile`

## 3. `ConnectedAccountsSection.tsx` (EDIT)
Путь: `apps/web/src/features/update-profile/ui/ConnectedAccountsSection.tsx`

- [ ] Состояния: `isTelegramUnlinkDialogOpen`, `isGithubUnlinkDialogOpen` (опц. `showTelegramUnlinkCodeDialog`)
- [ ] По клику на «Отвязать Telegram» — открыть диалог (не вызывать мутацию)
- [ ] По клику на «Отвязать GitHub» — открыть диалог
- [ ] ConfirmDialog: текст предупреждения (ADR-005). Кнопки «Отмена», «Подтвердить отвязку». **Внимание:** в `@packages/ui` нет `ConfirmDialog` — создать общий компонент в `packages/ui` либо использовать app-local паттерн (как `DeleteCardConfirmDialog`)
- [ ] On confirm — закрыть диалог, вызвать мутацию отвязки (предпочтительно эндпоинт из `@packages/api`, иначе `updateProfile` с null **после подтверждения**)
- [ ] Обработка loading, успех/ошибка (toasts)

## 4. Тесты
- [ ] Unit-тесты на подтверждение отвязки (отмена не вызывает мутацию, подтверждение вызывает)

## 5. Проверки
- [ ] tsc без ошибок
- [ ] i18n ключи
