# Задачи: Сброс и восстановление пароля (Forgot & Reset Password)

Данный документ содержит декомпозицию задач для **Backend** и **Frontend** по сбросу пароля для неавторизованного пользователя через Email, архитектурную диаграмму и структуру файлов.

---

## 1. Архитектурная диаграмма потока восстановления пароля

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 Пользователь
    participant Web as 🌐 apps/web
    participant API as 🚀 apps/api (NestJS)
    participant Redis as ⚡ Redis
    participant DB as 🗄️ PostgreSQL
    participant MQ as 🐇 RabbitMQ / Email

    Note over User, MQ: Шаг 1: Запрос сброса (Forgot Password)
    User->>Web: 1. Ввод Email на /forgot-password
    Web->>API: 2. POST /api/v1/auth/forgot-password { email }
    API->>DB: 3. Поиск пользователя по email
    alt Пользователь найден
        Note over API: token = crypto.randomBytes(32).toString('hex')
        API->>Redis: 4. SET reset_token:SHA256(token) = userId (TTL 15 мин)
        API->>MQ: 5. Publish 'email.password_reset' { email, resetUrl }
    end
    API-->>Web: 6. 200 OK (Одинаковый ответ для защиты от перечисления пользователей)

    Note over User, MQ: Шаг 2: Установка нового пароля (Reset Password)
    User->>Web: 7. Переход по ссылке /reset-password#token=RAW_TOKEN
    Note over Web: Токен читается из window.location.hash (клиент).
    Note over Web: Fragment никогда не отправляется на сервер и не логируется прокси.
    User->>Web: 8. Ввод newPassword и newPasswordConfirmation
    Web->>API: 9. POST /api/v1/auth/reset-password { token, newPassword, newPasswordConfirmation }
    API->>Redis: 10. redis.getdel(reset_token:SHA256(token))
    API->>DB: 11. Обновление passwordHash = Argon2id.hash(newPassword)
    API->>Redis: 12. Инвалидация всех активных refresh-сессий пользователя
    API-->>Web: 13. 200 OK ("The password has been successfully changed")
    Web-->>User: 14. Toast + автоматический редирект на /login
```

---

## 2. Структура файлов в монорепозитории

### 2.1. Packages (`packages/dto`):
```text
packages/dto/src/
└── auth/
    ├── forgot-password.dto.ts             # forgotPasswordSchema (email)
    ├── reset-password.dto.ts              # resetPasswordSchema (token, newPassword, newPasswordConfirmation)
    └── index.ts
```

### 2.2. Backend (`apps/api`):
```text
apps/api/src/modules/
└── auth/
    ├── auth.controller.ts                 # POST /auth/forgot-password, POST /auth/reset-password
    ├── auth.controller.spec.ts
    ├── auth.service.ts                    # Генерация токенов, валидация Redis, смена пароля
    ├── auth.service.spec.ts
    └── auth.module.ts
```

### 2.3. Frontend (`apps/web` по FSD):
```text
apps/web/src/
├── app/
│   └── (auth)/
│       ├── forgot-password/
│       │   └── page.tsx                   # Страница ввода Email для сброса
│       └── reset-password/
│           └── page.tsx                   # Страница ввода нового пароля по токену
│
└── features/
    └── auth/
        ├── forgot-password/               # Фича запроса сброса
        │   ├── ui/
        │   │   ├── ForgotPasswordForm.tsx
        │   │   └── ForgotPasswordSuccess.tsx
        │   ├── model/
        │   │   └── useForgotPassword.ts
        │   └── index.ts
        │
        └── reset-password/                # Фича установки нового пароля
            ├── ui/
            │   ├── ResetPasswordForm.tsx
            │   └── InvalidTokenAlert.tsx
            ├── model/
            │   └── useResetPassword.ts
            └── index.ts
```

---

# 🚀 Часть 1: Backend (`apps/api`, `packages/dto`, Redis)

### Заголовок задачи:
`feat(api): реализация сброса и восстановления пароля через Email (Forgot / Reset Password)`

### Чеклист задач:
- [ ] **DTO и валидация (`packages/dto`):**
  - Схема `forgotPasswordSchema` (`email`).
  - Схема `resetPasswordSchema` (`token`, `newPassword`, `newPasswordConfirmation`).
- [ ] **Сервис и контроллеры (`apps/api`):**
  - `POST /api/v1/auth/forgot-password`: генерация токена, сохранение `SHA256(token)` в Redis (TTL 15 мин), публикация события отправки письма. Ответ всегда `200 OK`.
  - `POST /api/v1/auth/reset-password`: атомарная проверка и удаление токена (`redis.getdel`), хэширование через Argon2id, обновление `User.passwordHash`, инвалидация всех refresh-токенов пользователя.
  - Настройка Throttler (макс. 3 запроса в минуту).
- [ ] **Тестирование:**
  - Unit и E2E тесты для успешного сброса, невалидного/просроченного токена и защиты от перечисления.

---

# 🎨 Часть 2: Frontend (`apps/web`, `@packages/ui`, `@packages/i18n`)

### Заголовок задачи:
`feat(web): страницы и формы восстановления пароля (Forgot Password и Reset Password)`

### Чеклист задач:
- [ ] **Страница `/forgot-password`:**
  - Форма ввода email с валидацией (`react-hook-form` + Zod).
  - Мутация `POST /api/v1/auth/forgot-password`.
  - Экран подтверждения отправки письма с таймером повторной отправки (60 сек).
- [ ] **Страница `/reset-password`:**
  - Считывание `token` из URL-фрагмента (`#token=...`) на клиенте (`window.location.hash`).
    Fragment не передаётся на сервер, не логируется прокси — защита от CWE-598.
  - Форма ввода нового пароля и подтверждения с иконкой `Eye`/`EyeOff`.
  - Мутация `POST /api/v1/auth/reset-password`.
  - Обработка истекшего токена и успешного сброса с редиректом на `/login`.
- [ ] **Ссылка на странице входа:**
  - Добавить ссылку «Забыли пароль?» на странице `/login`.
- [ ] **Локализация (`@packages/i18n`):**
  - Переводы всех форм и сообщений в `ru/auth.json` и `en/auth.json`.
