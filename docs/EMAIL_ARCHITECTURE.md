# Email Service & Notifications Architecture

Документ описывает архитектуру транзакционных почтовых уведомлений, структуру шаблонов писем, систему транспортов, сборку пакетов, конфигурацию и методику тестирования в проекте **MockInterviewAI**.

---

## 1. Обзор архитектуры

Система отправки писем построена на строгом модульном разделении ответственности:
- `@packages/email` — шаблоны писем на [React Email](https://react.email) с адаптивной версткой под десктопные и мобильные почтовые клиенты. Инкапсулирует вызовы React, JSX-компоненты и логику рендеринга (`renderTemplate()`).
- `@packages/i18n` — многоязычные переводы тем и содержимого писем (`ru`, `en`), собирается с помощью Rslib в ESM/CJS форматы.
- `MailModule` (`apps/api/src/modules/mail`) — NestJS сервис отправки писем с поддержкой сменяемых транспортов (`IMailTransport`). Не содержит зависимостей от React и не импортирует JSX-разметку.

```
                    ┌────────────────────────┐
                    │  NestJS Domain Modules │
                    │  (Auth, Matchmaking)   │
                    └───────────┬────────────┘
                                │ sendTemplate({ template, to, props, locale })
                                ▼
                    ┌────────────────────────┐
                    │      MailService       │
                    │      (apps/api)        │
                    └───────────┬────────────┘
                                │
                                │ renderTemplate(template, props, locale)
                                ▼
                    ┌────────────────────────┐
                    │    @packages/email     │
                    │    (Zero React в API)  │
                    └─────┬────────────┬─────┘
                          │            │
       1. Получение строк i18n         2. Рендер в HTML + Plain Text
              │                        │  (React.createElement +
              ▼                        │   @react-email/render)
       ┌──────────────┐                ▼
       │@packages/i18n│         ┌──────────────┐
       │(Rslib ESM/CJS│         │  HTML + Text │
       │  переводы)   │         │  + Subject   │
       └──────────────┘         └──────────────┘
                          │
                          │ 3. Передача в активный транспорт (IMailTransport)
                          ▼
            ┌─────────────────────────────┐
            │   MAIL_TRANSPORT_TOKEN      │
            └───────┬─────────────┬───────┘
                    │             │
      MAIL_TRANSPORT="dev-logger" │ MAIL_TRANSPORT="smtp"
                    ▼             ▼
       ┌──────────────────────┐ ┌──────────────────────┐
       │  DevLoggerTransport  │ │  NodemailerTransport │
       │  - Консольный лог    │ │  - SMTP сервер       │
       │  - Файл в .mail-     │ │    (Mailpit / Prod)  │
       │    preview/*.html    │ └──────────────────────┘
       └──────────────────────┘
```

---

## 2. Изоляция зависимостей и сборка пакетов

### Принцип Clean API (Zero React Runtime в бэкенде)
Бэкенд `apps/api` не имеет зависимостей `react`, `@types/react` и `@react-email/render`. Вся работа с JSX-компонентами изолирована внутри пакета `@packages/email`. `apps/api` взаимодействует с почтовым пакетом через контракт:
```typescript
// Сигнатура функции renderTemplate:
export declare function renderTemplate<K extends EmailTemplateKey>(
  template: K,
  props: EmailTemplatePropsMap[K],
  locale?: Locale,
): Promise<{ html: string; text: string; subject: string }>;
```

### Сборка пакетов
- **`@packages/i18n`**: собирается через **Rslib** (`@rslib/core`), производя ESM (`dist/index.js`) и CJS (`dist/index.cjs`) бандлы вместе с объявлениями типов (`d.ts`).
- **`@packages/email`**: компилируется через стандартный компилятор `tsc` в CommonJS (`dist/index.js`, `dist/index.d.ts`), что обеспечивает нативную совместимость с Node.js/NestJS средой без необходимости транспиляции JSX на стороне API.

---

## 3. Шаблоны писем (`@packages/email`)

Пакет экспортирует готовые шаблоны и функции рендеринга.

| Имя шаблона (`EmailTemplateKey`) | Компонент | Назначение | Props (`EmailTemplatePropsMap[K]`) |
| :--- | :--- | :--- | :--- |
| `verify-email` | `VerifyEmailTemplate` | Подтверждение email при регистрации | `username`, `expiresMinutes`, `verifyUrl?`, `code?` |
| `reset-password` | `ResetPasswordTemplate` | Восстановление пароля | `username`, `resetUrl`, `expiresMinutes` |
| `interview-scheduled` | `InterviewScheduledTemplate` | Назначение тренировочного собеседования | `partnerName`, `scheduledTime`, `roomUrl`, `username?`, `role?`, `topic?` |
| `interview-reminder` | `InterviewReminderTemplate` | Напоминание перед интервью | `partnerName`, `minutesUntilStart`, `roomUrl`, `username?`, `topic?` |
| `security-alert` | `SecurityAlertTemplate` | Оповещение безопасности аккаунта | `eventType`, `ipAddress`, `timestamp`, `username?`, `email?`, `userAgent?`, `device?`, `location?`, `details?`, `securityUrl?` |

---

## 4. Конфигурация окружения

Переменные окружения настраиваются в файле `.env` приложения `apps/api`:

| Переменная | По умолчанию | Описание |
| :--- | :--- | :--- |
| `MAIL_TRANSPORT` | `dev-logger` | Активный транспорт: `dev-logger` (для разработки/тестов) или `smtp` (для реальной отправки / Mailpit) |
| `SMTP_HOST` | `localhost` | Хост SMTP сервера |
| `SMTP_PORT` | `1025` | Порт SMTP сервера (для Mailpit порт по умолчанию `1025`) |
| `SMTP_SECURE` | `false` | `true` для TLS (порт 465), `false` для STARTTLS/без шифрования (порт 587/1025/25) |
| `SMTP_USER` | `""` | Имя пользователя SMTP (опционально) |
| `SMTP_PASSWORD` | `""` | Пароль SMTP (опционально) |
| `SMTP_FROM` | `MockInterviewAI <noreply@mockinterview.ai>` | Адрес и имя отправителя по умолчанию |

---

## 5. Транспорты отправки

### 1. `DevLoggerTransport` (`MAIL_TRANSPORT=dev-logger`)
- Используется локально и в тестах по умолчанию.
- Не требует подключения к сети или запущенного SMTP-сервера.
- Выводит структурированное превью в консоль NestJS: получатель, тема, текстовая версия.
- Сохраняет полный HTML письма в файл `apps/api/.mail-preview/<ISO-timestamp>_<subject>.html` для быстрой проверки верстки в браузере.

### 2. `NodemailerTransport` (`MAIL_TRANSPORT=smtp`)
- Использует транспорт `nodemailer` с пулом соединений.
- Подходит для локального перехватчика писем (**Mailpit** / MailHog) и для production SMTP (SendGrid, Postmark, AWS SES, Mailgun, Яндекс 360).

---

## 6. Использование в доменных сервисах

Модуль `MailModule` регистрируется глобально или импортируется в нужный модуль. Сервис строго типизирован дженериком `SendTemplateOptions<K>`:

```typescript
import { Injectable } from "@nestjs/common";
import { MailService } from "../mail/mail.service";

@Injectable()
export class AuthService {
  constructor(private readonly mailService: MailService) {}

  async sendPasswordReset(email: string, username: string, resetUrl: string, locale: "ru" | "en" = "ru"): Promise<void> {
    await this.mailService.sendTemplate({
      template: "reset-password",
      to: email,
      locale,
      props: {
        username,
        resetUrl,
        expiresMinutes: 15,
      },
    });
  }
}
```

---

## 7. Локальная разработка и тестирование

### Интерактивная верстка шаблонов в браузере:
```bash
# Запуск dev-сервера React Email
pnpm email:dev
```
Откройте `http://localhost:3025` для визуального редактирования и предпросмотра шаблонов с live reload.

### Сборка пакетов:
```bash
# Сборка переводов i18n через Rslib
pnpm --filter @packages/i18n build

# Сборка пакета писем через tsc
pnpm --filter @packages/email build
```

### Запуск тестов:
```bash
# Unit-тесты MailService и транспортов
pnpm --filter api test apps/api/src/modules/mail/mail.service.spec.ts

# Полный сьют тестов API
pnpm test:api
```
