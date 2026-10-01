# @packages/email

Пакет переиспользуемых транзакционных email-шаблонов и базовых компонентов платформы **MockInterviewAI** на базе [React Email](https://react.email).

Пакет предназначен для серверного рендера писем в HTML и Plain-text (`apps/api`), а также для интерактивной визуальной разработки шаблонов в браузере.

---

## Возможности

- **Базовые UI-компоненты**: адаптивная верстка под все популярные почтовые клиенты (Outlook, Gmail, Apple Mail), поддержка темной/светлой темы, логотипы, CTA-кнопки, моноширинные плашки OTP-кодов.
- **Транзакционные шаблоны**:
  - `verify-email` — подтверждение адреса электронной почты при регистрации;
  - `reset-password` — безопасная ссылка для сброса пароля;
  - `interview-scheduled` — бронирование слота и ссылка на комнату интервью;
  - `interview-reminder` — напоминание о скором начале сессии;
  - `security-alert` — уведомление о смене пароля или подозрительном входе.
- **Двойной рендер (`renderEmail`)**: автоматическая генерация как HTML-версии, так и чистой текстовой (`plain-text`) версии для антиспам-фильтров.
- **Интерактивный Dev-сервер**: мгновенный просмотр и отладка верстки писем в реальном времени.

---

## Структура пакета

```text
packages/email/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── components/              # Базовые UI-компоненты писем
    │   ├── layout.tsx           # Общая обертка (Html, Head, Preview, Body, Container)
    │   ├── header.tsx           # Шапка с логотипом сервиса
    │   ├── footer.tsx           # Подвал с отпиской и копирайтом
    │   ├── button.tsx           # Фирменная CTA-кнопка
    │   └── otp-code.tsx         # Плашка 4-6 значного проверочного кода
    ├── templates/               # Готовые шаблоны писем
    │   ├── verify-email.tsx     # Подтверждение email
    │   ├── reset-password.tsx   # Сброс пароля
    │   ├── interview-scheduled.tsx # Подтверждение слота интервью
    │   ├── interview-reminder.tsx  # Напоминание об интервью
    │   ├── security-alert.tsx   # Алерт безопасности
    │   └── index.ts
    ├── render.ts                # Функция рендера HTML + Plain-text
    └── index.ts                 # Точка входа (публичный API пакета)
```

---

## Локальная разработка и превью

Для визуальной верстки и тестирования шаблонов в браузере запустите локальный сервер React Email:

```bash
# Из корня монорепозитория:
pnpm --filter @packages/email dev

# Или через алиас в корневом package.json:
pnpm email:dev
```

Сервер откроет веб-интерфейс на `http://localhost:3000` со списком шаблонов, возможностью переключения мобильного/десктопного экранов и исходного кода.

---

## Использование в бэкенде (`apps/api`)

```typescript
import { renderEmail, ResetPasswordTemplate } from "@packages/email";

// Рендер шаблона в HTML и text
const { html, text } = await renderEmail(
  <ResetPasswordTemplate
    username="Алексей"
    resetUrl="https://mockinterview.tech/auth/reset-password?token=xyz"
    expiresMinutes={15}
    texts={textsFromI18n}
  />
);

// Передача в почтовый транспорт
await mailTransport.send({
  to: "user@example.com",
  subject: "Восстановление пароля",
  html,
  text,
});
```

---

## Доступные скрипты

| Команда | Описание |
|---|---|
| `pnpm dev` | Запуск dev-сервера предпросмотра шаблонов React Email |
| `pnpm build` | Проверка типов (`tsc --noEmit`) |
| `pnpm typecheck` | Проверка типов TypeScript |
| `pnpm lint` | Проверка кода линтером Biome |
| `pnpm format` | Форматирование кода через Biome |
