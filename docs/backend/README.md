# Backend Documentation

Добро пожаловать в техническую документацию бэкенда платформы! Здесь собраны правила, стандарты, архитектурные решения и руководства по разработке серверной части.

---

## ⚡ Шпаргалка: Куда положить код? (Decision Tree)

```text
Какой тип бэкенд-кода вы создаете?
├── REST API эндпоинт, бизнес-логика или CRUD сущности?
│   ├── Модуль домена (Auth, Users, Sessions, Feedback) ──► apps/api/src/modules/<module-name>/
│   │   ├── HTTP маршрутизация и DTO валидация ──► <module-name>.controller.ts
│   │   ├── Бизнес-логика и транзакции ──► <module-name>.service.ts
│   │   └── Специфичные гарды/пайпы ──► guards/, pipes/
│   │
│   ├── Валидация входных данных (Zod DTO)?
│   │   └── Добавить схему и DTO в переиспользуемый пакет ──► packages/dto/src/<domain>/
│   │
│   └── Глобальный фильтр, интерцептор, middleware или пайп?
│       └── apps/api/src/common/(filters|interceptors|guards|pipes|decorators)
│
├── Работа с базой данных (PostgreSQL)?
│   ├── Модели данных и связи ──► apps/api/prisma/schema.prisma
│   └── Сервис доступа к БД ──► apps/api/src/prisma/prisma.service.ts
│
├── Работа с кэшем, токенами или сессиями (Redis)?
│   └── apps/api/src/redis/
│
├── Работа с медиафайлами и хранилищем (S3 / MinIO)?
│   └── apps/api/src/modules/storage/ (или docs/STORAGE_S3.md)
│
├── Высоконагруженный Real-time / WebRTC / WebSocket?
│   └── Go-сервис ──► apps/realtime/
│       ├── Обработчики WebSocket и HTTP ──► apps/realtime/cmd/server/ или internal/delivery/
│       ├── Управление комнатами и сессиями ──► apps/realtime/internal/hub/
│       └── Интеграция с LiveKit / WebRTC ──► apps/realtime/internal/webrtc/
│
└── Изолированный запуск кода пользователей (Code Sandbox)?
    └── apps/code-runner/
```

---

## 📁 Структура разделов

### 1. [Архитектура](./architecture/overview.md)
* [Обзор бэкенд-архитектуры и сервисов](./architecture/overview.md)
* [Архитектура NestJS API модулей](./architecture/nestjs-modules.md)
* [Высоконагруженный Realtime сервис (Go)](./architecture/realtime-go.md)

### 2. [Базы данных и Хранилище](./data/database-prisma.md)
* [PostgreSQL и Prisma ORM](./data/database-prisma.md)
* [Redis: Сессии, Блэклисты и Pub/Sub](./data/redis-caching.md)
* [S3 Объектное хранилище (MinIO / R2)](./data/storage-s3.md)

### 3. [Безопасность и Аутентификация](./security/auth-jwt.md)
* [JWT-аутентификация, HttpOnly Cookies и Argon2id](./security/auth-jwt.md)
* [Rate-limiting (Throttling) и CORS политики](./security/auth-jwt.md#rate-limiting-и-безопасность)

### 4. [Стандарты разработки и Качество](./development/guidelines.md)
* [Стандарты кодирования (NestJS & Go)](./development/guidelines.md)
* [Обработка ошибок и логирование](./development/guidelines.md#обработка-ошибок)
* [Тестирование (Unit, E2E, Go test)](./development/guidelines.md#тестирование)
