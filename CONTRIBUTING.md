# Руководство контрибьютора (Contributing Guide)

Добро пожаловать в проект **MockInterviewAI**! Этот документ — точка входа для быстрого погружения в проект, локального запуска и правил работы с репозиторием.

---

## 🚀 Быстрый старт (Local Development Happy Path)

### 1. Системные требования
* **Node.js:** `>= 20.x`
* **pnpm:** `>= 9.x` (`corepack enable && corepack prepare pnpm@latest --activate`)
* **Docker & Docker Compose** (для PostgreSQL, Redis и MinIO)
* **Go (Golang):** `>= 1.26+` — **обязателен для полной сборки всех сервисов (`pnpm build`), запуска всех тестов (`pnpm test`) и WebSocket-сервиса `apps/realtime`**. *(Если Go не установлен, используйте точечную сборку фронтенда: `pnpm --filter web build`)*.

### 2. Клонирование и установка зависимостей
```bash
git clone https://github.com/Riko4502/MockInterviewAI.git
cd MockInterviewAI
pnpm install
```

### 3. Настройка переменных окружения
```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env # при разработке бэкенда
```
*(Для Windows CMD используйте команду `copy .env.example .env`)*

### 4. Запуск окружения
```bash
# Запуск только Frontend приложения (Next.js)
pnpm dev:web

# Запуск полного стека сервисов (требует запущенный Docker Desktop)
pnpm dev
```

---

## 🌐 Порты и доступные сервисы

После запуска локального окружения сервисы доступны по следующим адресам:

| Сервис | Адрес | Описание |
|---|---|---|
| **Web** (Next.js) | [http://localhost:3000](http://localhost:3000) | Основное веб-приложение платформы |
| **API** (NestJS) | [http://localhost:3001](http://localhost:3001) | REST API бэкенда ([Healthcheck](http://localhost:3001/api/v1/health)) |
| **Swagger UI** | [http://localhost:3001/docs](http://localhost:3001/docs) | Интерактивная документация API (OpenAPI 3.0) |
| **Realtime** (Go) | `ws://localhost:8080` | Высоконагруженный WebSocket-сервис |
| **Landing** (Astro) | [http://localhost:4321](http://localhost:4321) | Публичный маркетинговый сайт и SEO |
| **Storybook** | [http://localhost:6006](http://localhost:6006) | Изолированная витрина компонентов (`pnpm --filter ui-docs storybook`) |

---

## 🔀 Git Workflow & Правила работы

### 1. Ветки (Branching Strategy)
* Основная рабочая ветка разработки — **`dev`** (все фиче-ветки создаются от `dev` и вливаются обратно в `dev`).
* Ветка **`main`** содержит стабильные релизные версии для production.

### 2. Именование веток
Имя ветки должно отражать тип задачи и номер в таск-трекере (если есть):
* `feat/MOC-12-auth-page` — разработка нового функционала;
* `fix/MOC-45-session-disconnect` — исправление багов;
* `refactor/MOC-33-fsd-slices` — рефакторинг без изменения функционала;
* `docs/MOC-25-guidelines` — обновление документации;
* `chore/update-dependencies` — рутинные задачи по проекту.

### 3. Формат сообщений коммитов (Conventional Commits)
В проекте действует стандарт **Conventional Commits** с обязательным указанием `scope` (валидируется через `commitlint`):

```text
тип(scope): сообщение
```

Подробная таблица типов, допустимых `scope` и правила оформления описаны в 📖 [**Регламенте Pull Request**](./docs/pull-request.md).

**Примеры:**
* `feat(web): добавить форму входа с валидацией`
* `fix(ui): исправить placeholder в компоненте Input`
* `refactor(realtime): оптимизировать хранение сессий в Redis`
* `docs(repo): обновить регламент создания PR`

> 🐶 **Git-хуки (Husky):** При выполнении `git commit` автоматически запускаются линтер **Biome** и валидатор сообщений **commitlint**.

### 4. Чек-лист перед созданием Pull Request
Перед отправкой изменений запустите команду комплексной проверки:
```bash
# Проверка линтером и запуск тестов
pnpm lint && pnpm test
```
Подробный чеклист см. в [**docs/pull-request.md**](./docs/pull-request.md).

---

## 📚 Документация Frontend

Вся подробная техническая документация разделена по специализированным разделам в каталоге [`docs/frontend/`](./docs/frontend/README.md):

### 🏗 Архитектура
* [**Обзор архитектуры**](./docs/frontend/architecture/overview.md) — структура монорепозитория, границы приложений и пакетов.
* [**Feature-Sliced Design (FSD)**](./docs/frontend/architecture/fsd.md) — правила слоев, слайсов и импортов.
* [**Next.js App Router**](./docs/frontend/architecture/nextjs.md) — интеграция FSD с Next.js, Server vs Client Components.
* [**Astro Landing**](./docs/frontend/architecture/astro.md) — архитектура маркетингового лендинга.

### 🎨 UI и стили
* [**UI Kit & shadcn/ui**](./docs/frontend/ui/ui-kit.md) — работа с `@packages/ui`, добавление shadcn компонентов, Decision Tree.
* [**Стилизация (Tailwind CSS)**](./docs/frontend/ui/styling.md) — токены, глобальные стили, утилита `cn`.
* [**Storybook**](./docs/frontend/ui/storybook.md) — разработка и изолированное тестирование UI-компонентов.

### 💾 Данные и состояние
* [**API Contracts & OpenAPI**](./docs/frontend/data/api-contracts.md) — workflow обновления контрактов с бэкенда.
* [**TanStack Query**](./docs/frontend/data/tanstack-query.md) — работа с серверным состоянием, кэширование и мутации.
* [**State Management**](./docs/frontend/data/state-management.md) — матрица выбора: Query vs Zustand vs React State vs Form.

### ⚙️ Разработка и качество
* [**TypeScript Guidelines**](./docs/frontend/development/typescript.md) — strict mode, типизация, запрет `any`.
* [**Тестирование**](./docs/frontend/development/testing.md) — Vitest, React Testing Library, Playwright.
* [**Сборка и команды**](./docs/frontend/development/build.md) — команды Turborepo и pnpm.
* [**Зависимости**](./docs/frontend/development/dependencies.md) — правила добавления новых npm-пакетов.

### 👥 Процессы
* [**Pull Request Policy**](./docs/frontend/processes/pull-request.md) — правила ревью, линтеры, критерии слияния.
* [**Архитектурные решения (ADR)**](./docs/frontend/processes/adr.md) — как фиксировать значимые изменения.

---

## 📚 Документация Backend

Вся техническая документация серверной части собрана в каталоге [`docs/backend/`](./docs/backend/README.md):

### 🏗 Архитектура
* [**Обзор бэкенд-архитектуры**](./docs/backend/architecture/overview.md) — сервисы `apps/api`, `apps/realtime`, `apps/code-runner`.
* [**NestJS Модули**](./docs/backend/architecture/nestjs-modules.md) — структура контроллеров, сервисов, DTO/Zod валидация.
* [**Realtime сервис (Go)**](./docs/backend/architecture/realtime-go.md) — WebSocket Hub, комнаты, Redis Pub/Sub, LiveKit.

### 💾 Базы данных и Хранилище
* [**PostgreSQL и Prisma ORM**](./docs/backend/data/database-prisma.md) — схемы, миграции, соглашения по именованию.
* [**Redis**](./docs/backend/data/redis-caching.md) — хранение сессий, блэклисты токенов, рейт-лимиты.
* [**S3 Хранилище**](./docs/backend/data/storage-s3.md) — объектное хранилище MinIO/R2, бакеты и префиксы.

### 🔒 Безопасность и Стандарты
* [**Безопасность и JWT**](./docs/backend/security/auth-jwt.md) — токены в HttpOnly cookies, Argon2id, CSRF защита.
* [**Стандарты разработки**](./docs/backend/development/guidelines.md) — линтинг (Biome/golangci-lint), обработка ошибок, логирование и тесты.

---

## 🛠️ Документация DevOps & CI/CD

Вся документация по инфраструктуре, пайплайнам и деплою собрана в каталоге [`docs/devops/`](./docs/devops/README.md):

### 🐳 Инфраструктура и Пайплайны
* [**Локальная инфраструктура**](./docs/devops/infrastructure/local-docker.md) — Docker Compose (PostgreSQL, Redis, MinIO S3), команды `infra:up` / `infra:down`.
* [**CI/CD Пайплайны**](./docs/devops/ci-cd/pipelines.md) — Reusable workflows, paths-filter, кэширование Turborepo.
* [**Релизы и Версионирование**](./docs/devops/ci-cd/releases.md) — сборка архивов по тегам, S3 хранилище, Release Drafter.
* [**Production Деплой**](./docs/devops/deployment/production.md) — `docker-compose.prod.yml`, multi-stage Dockerfiles, SSH деплой.
* [**Мониторинг и Алерты**](./docs/devops/monitoring/telegram-alerts.md) — Telegram-бот, топики чата и GitHub Secrets.


