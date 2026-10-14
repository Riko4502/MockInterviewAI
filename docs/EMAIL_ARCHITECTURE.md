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
- Использует транспорт `nodemailer` по протоколу SMTP.
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

---

## 8. Пошаговое добавление нового шаблона письма

1. **Создание шаблона в `@packages/email`**:
   - Создайте файл компонента в `packages/email/src/templates/<my-template>.tsx`.
   - Используйте базовые компоненты из `@packages/email` (`Layout`, `Header`, `Footer`, `Button`, `Text`).
   - Получайте переводы через `getMessages(locale).email.<myTemplate>`.

2. **Добавление переводов в `@packages/i18n`**:
   - Добавьте локализованные строки в `packages/i18n/src/locales/ru/common.json` и `en/common.json` в секцию `"email"`.
   - Пересоберите пакет переводов:
     ```bash
     pnpm --filter @packages/i18n build
     ```

3. **Регистрация шаблона в контрактах `@packages/email`**:
   - В `packages/email/src/types.ts` добавьте интерфейс входных пропсов:
     ```typescript
     export interface MyTemplateProps {
       username: string;
       actionUrl: string;
     }
     ```
   - Зарегистрируйте ключ шаблона в `EmailTemplatePropsMap`:
     ```typescript
     export interface EmailTemplatePropsMap {
       // ...
       'my-template': MyTemplateProps;
     }
     ```
   - Экспортируйте шаблон в `packages/email/src/index.ts` и зарегистрируйте в функции `renderTemplate` (`packages/email/src/render.ts`).
   - Соберите пакет писем:
     ```bash
     pnpm --filter @packages/email build
     ```

4. **Использование в NestJS**:
   ```typescript
   await this.mailService.sendTemplate({
     template: 'my-template',
     to: user.email,
     locale: user.locale ?? 'ru',
     props: {
       username: user.displayName,
       actionUrl: 'https://...',
     },
   });
   ```

---

## 9. Настройка SMTP-провайдеров

### 1. Локальный перехватчик (Mailpit)
Рекомендуется для локальной отладки без отправки в реальную сеть:
```env
MAIL_TRANSPORT=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_FROM=MockInterviewAI <noreply@mockinterview.ai>
```
Веб-интерфейс писем будет доступен на `http://localhost:8025`.

### 2. Google / Gmail SMTP
Для отправки через аккаунт Google **обязательно** используется [Пароль приложения (App Password)](https://myaccount.google.com/apppasswords) при включенной 2FA:
```env
MAIL_TRANSPORT=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-account@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx # 16-значный пароль приложения без пробелов
SMTP_FROM=MockInterviewAI <your-account@gmail.com>
```

### 3. Yandex 360 / Почта для домена
Требуется «Пароль для внешних приложений» в Яндекс ID:
```env
MAIL_TRANSPORT=smtp
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=ваш_пароль_приложения_яндекса
SMTP_FROM=MockInterviewAI <noreply@yourdomain.com>
```

### 4. Транзакционные провайдеры (Resend, SendGrid, Brevo)
Пример для Resend через SMTP:
```env
MAIL_TRANSPORT=smtp
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASSWORD=re_123456789 # Ваш API ключ Resend
SMTP_FROM=MockInterviewAI <noreply@yourdomain.com>
```

---

## 10. Деплой и инфраструктура

### Render Blueprint (`render.yaml`)
В спецификации сервиса `devsync-api`:
- `MAIL_TRANSPORT`: по умолчанию `dev-logger` (сервис стартует безопасно даже без кредов SMTP);
- При подключении реального почтового сервера в Dashboard Render указываются: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`.

### Docker (`docker-compose.prod.yml`)
Переменные проброшены в контейнер `api`:
```yaml
services:
  api:
    environment:
      - MAIL_TRANSPORT
      - SMTP_HOST
      - SMTP_PORT
      - SMTP_SECURE
      - SMTP_USER
      - SMTP_PASSWORD
      - SMTP_FROM
```
Значения читаются напрямую из хостового `.env` при запуске контейнеров.

