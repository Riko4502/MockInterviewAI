# Сервис проведения технических и мок-интервью

## Описание проекта

Проект предназначен для практической разработки комплексного сервиса, охватывающего разные сферы: от базовой продуктовой логики и real-time взаимодействия до внедрения ИИ и настройки инфраструктуры. Проект рассчитан на командную разработку.

### Тип продукта
Сервис проведения технических и мок-интервью.

### Цель продукта
Сервис подходит как для учащихся, так и для работодателей:
- Работодатель может в одном месте проводить техническое интервью с камерой и написанием кода в real time.
- Кандидаты могут в рамках приложения искать других пользователей и проводить друг другу пробные интервью.

---

## Обязательный функционал

1. **Аутентификация и авторизация**
2. **Лендинг** – [доступно онлайн](https://mock-interview-ai-landing.vercel.app/)
3. **Создание сессий и приглашение участников**
   - Создание сессии и приглашение участников.
   - Создание закрытых сессий с паролем.
4. **Real-time редактор кода**
   - Изменения видят все участники сессии в реальном времени.
   - Подсветка кода и автокомплит.
   - Опционально: запуск кода.
5. **Витрина участников**
   - Создание карточки пользователя с указанием стека и уровня.
   - Возможность откликнуться на карточку другого участника.
   - Автоматическое создание сессии на 2 человек для взаимного собеседования.
   - Уведомления от Telegram-бота обоим участникам о запуске сессии.
6. **Поиск и фильтры**
   - Поиск нужных карточек по стеку и уровню.
   - Наличие фильтров.
7. **Подсказки от ИИ**
   - Кнопка подсказки от ИИ, которой можно воспользоваться 3 раза за собеседование.
   - ИИ не дает конкретный ответ, а дает наводящую подсказку.
   - Все участники сессии видят, что кнопка была нажата, и видят текст подсказки.
8. **Обратная связь и оценки**
   - Страница обратной связи после собеседования для сохранения истории и результатов.
   - Оценка по шкале от 0 до 10.
9. **История собеседований**
   - Страница с историей прохождения собеседований.
   - Страница просмотра обратной связи из предыдущих сессий.
10. **Личный кабинет**
    - Страница личного кабинета с возможностью изменения персональных данных.
11. **Лидерборд**
    - Страница с отображением топа пользователей по количеству проведенных собеседований.

---

## Технические требования и стек

* **Frontend:** Next.js (App Router), React, TypeScript
* **Design & UI Kit:** [Figma Design](https://www.figma.com/design/VECvKw5Y6rCYdvGafOTIsD/Untitled?node-id=0-1&p=f&t=IbAQQaPdEzqNPtJ4-0)
* **Design System & UI Docs:** Storybook (`apps/ui-docs`) – [доступно онлайн](https://ui-docs-mocha.vercel.app/), `@packages/ui`, `@packages/icons`
* **Realtime Service:** Go 1.26.6, WebSocket (`coder/websocket`), Chi router
* **Backend API:** Nest.js, Prisma ORM, PostgreSQL
* **State & Caching:** Redis (Pub/Sub + сессии)
* **Object Storage:** S3-совместимое хранилище (MinIO для dev / Cloudflare R2 / AWS S3 в prod)
* **Monorepo & Build Tooling:** Turborepo, pnpm workspaces, Biome, Docker

---

## Требования для локальной разработки

Перед началом работы убедитесь, что у вас установлены:
* **Node.js:** >= 20.x
* **pnpm:** >= 9.x (`corepack enable && corepack prepare pnpm@latest --activate`)
* **Go:** >= 1.26.6 (для сервиса Realtime)
* **Docker & Docker Compose:** для локального запуска PostgreSQL, Redis и MinIO

---

## Установка и запуск проекта

### 1. Клонирование репозитория
```bash
git clone https://github.com/Riko4502/MockInterviewAI.git
cd MockInterviewAI
```

### 2. Настройка переменных окружения
Создайте корневой файл `.env` на основе примера:
```bash
cp .env.example .env
```
Заполните обязательные переменные (или оставьте локальные значения по умолчанию):
* `JWT_ACCESS_SECRET` и `JWT_REFRESH_SECRET` (минимум 32 символа)
* `ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000`
* `REDIS_HOST=localhost`, `REDIS_PORT=6379`
* `S3_ENDPOINT=http://localhost:9000`, `S3_BUCKET_NAME=mock-interview-storage`

### 3. Установка зависимостей
```bash
pnpm install
```

### 4. Запуск локальной инфраструктуры (Postgres, Redis, MinIO)
```bash
# Поднять PostgreSQL, Redis и MinIO (S3)
pnpm run infra:up

# Остановить контейнеры
pnpm run infra:down
```

* Веб-консоль MinIO доступна по адресу `http://localhost:9001` (логин: `minioadmin`, пароль: `minioadmin`).
* S3 API эндпоинт: `http://localhost:9000`.

### 5. Миграции базы данных и Prisma
После поднятия базы данных примените миграции:
```bash
# Применить миграции для разработки (создает новые миграции при изменении схемы)
pnpm run db:migrate
# или: pnpm --filter api db:migrate:dev

# Применить уже существующие миграции (без запроса имени миграции)
pnpm run db:migrate:deploy
# или: pnpm --filter api db:migrate:deploy

# Генерация Prisma Client
pnpm run db:generate
# или: pnpm --filter api db:generate
```

### 6. Запуск сервисов в режиме разработки

#### Запуск всех сервисов одновременно (Turborepo):
```bash
pnpm dev
```

#### Запуск конкретных сервисов по отдельности:
* **Backend API (Nest.js - порт 3001):**
  ```bash
  pnpm dev:api
  # или: pnpm --filter api dev
  ```
* **Frontend (Next.js - порт 3000):**
  ```bash
  pnpm dev:web
  ```
* **Landing Page:**
  ```bash
  pnpm dev:landing
  ```
* **Storybook / UI-документация и каталог иконок (порт 6006):**
  ```bash
  pnpm dev:storybook
  # или: pnpm --filter ui-docs storybook
  ```
* **Realtime WebSocket сервис (Go - порт 8080):**
  ```bash
  pnpm dev:realtime
  ```
  *(или напрямую через Go: `cd apps/realtime && go run cmd/server/main.go`)*

---

## 📚 Документация

* 🎨 **[Figma Design](https://www.figma.com/design/VECvKw5Y6rCYdvGafOTIsD/Untitled?node-id=0-1&p=f&t=IbAQQaPdEzqNPtJ4-0)** — дизайн-макеты интерфейса и UI-кита.
* 📖 **[Frontend Документация](docs/frontend/README.md)** — архитектура (FSD, App Router), соглашения и структура.
* 🎨 **[Storybook Guidelines & Галерея иконок](docs/frontend/ui/storybook.md)** — правила создания Stories, запуск Storybook и работа с `@packages/ui` и `@packages/icons`.
* 🧩 **[UI Kit & shadcn/ui](docs/frontend/ui/ui-kit.md)** — компоненты дизайн-системы и токены.
* 🌐 **[WebSocket Architecture](docs/WEBSOCKET_ARCHITECTURE.md)** — документация сервиса реального времени на Go.
* 📡 **[SSE Architecture](docs/SSE_ARCHITECTURE.md)** — архитектура Server-Sent Events.
* 🗄️ **[S3 Storage](docs/STORAGE_S3.md)** — организация объектного хранилища MinIO/S3.
* 🌍 **[i18n Localization](docs/I18N.md)** — архитектура и руководство по интернационализации (`@packages/i18n`).

---

## Тестирование и проверка качества кода

* **Запуск всех тестов:**
  ```bash
  pnpm test
  ```
* **Тесты Backend API (Nest.js / Jest):**
  ```bash
  pnpm test:api
  ```
* **Тесты сервиса Realtime (Go):**
  ```bash
  pnpm test:realtime
  ```
* **Тесты веб-приложения (Jest / React Testing Library):**
  ```bash
  pnpm test:web
  ```
* **Проверка линтерами (Biome & golangci-lint):**
  ```bash
  pnpm lint
  # или для конкретных приложений:
  pnpm lint:api
  pnpm lint:realtime
  ```

---

## Production сборка и Docker

### Сборка через Turborepo:
```bash
pnpm build
```

### Запуск полного стека в Docker Compose:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

- Обязательное покрытие тестами основного функционала.

---

## Локальная разработка

Требования: Node.js, pnpm, запущенный Docker Desktop.

```bash
# 1. Установка зависимостей (после клонирования)
pnpm install

# 2. Настройка переменных окружения
cp .env.example .env
cp apps/api/.env.example apps/api/.env   # Windows: copy apps\api\.env.example apps\api\.env

# 3. Запуск инфраструктуры (PostgreSQL, Redis, MinIO)
pnpm run infra:up

# 4. Запуск сервисов в режиме разработки
pnpm dev                 # все сервисы (web + api); требует запущенную инфраструктуру
pnpm --filter api dev    # только API: автоматически поднимет infra (если не запущена),
                         # применит миграции (migrate deploy) и запустит nest start --watch

# Остановка контейнеров инфраструктуры
pnpm run infra:down
```

`GET http://localhost:3001/api/v1/health` → `200 { "status": "ok", "db": "up" }`.

> Примечание: `pnpm dev` (все сервисы) жёстко зависит от Docker — при недоступном Docker падает целиком. Для работы только с web используйте `pnpm --filter web dev`.
