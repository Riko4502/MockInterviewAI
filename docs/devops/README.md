# DevOps & CI/CD Documentation

Добро пожаловать в техническую документацию по **DevOps, CI/CD и Инфраструктуре** проекта! Здесь описано устройство локальной среды, автоматизированных пайплайнов GitHub Actions, деплоя и системы алертинга.

---

## ⚡ Шпаргалка: С чем вы работаете? (Decision Tree)

```text
Какую DevOps-задачу вы решаете?
├── Локальная разработка и инфраструктура?
│   ├── Запуск Postgres, Redis, MinIO ──► pnpm run infra:up (корневой docker-compose.yml)
│   ├── Остановка инфраструктуры ──► pnpm run infra:down
│   └── Веб-консоль MinIO S3 ──► http://localhost:9001 (minioadmin / minioadmin)
│
├── Непрерывная интеграция (CI) и проверки PR?
│   ├── Главный оркестратор CI (paths-filter) ──► .github/workflows/ci.yml
│   ├── Тесты и линтинг Web ──► .github/workflows/ci-web.yml
│   ├── Тесты API и Prisma ──► .github/workflows/ci-api.yml
│   ├── Тесты и линтинг Realtime (Go) ──► .github/workflows/ci-realtime.yml
│   └── Поиск секретов (TruffleHog) ──► .github/workflows/ci-security.yml
│
├── Релизы и версионирование?
│   ├── Релизный пайплайн по тегу (S3 + Telegram) ──► .github/workflows/release.yml
│   ├── Черновики релизов (Release Drafter) ──► .github/workflows/draft-release.yml
│   └── Гайдлайн по выпуску релиза ──► docs/RELEASES.md
│
├── Деплой на боевой сервер (Production)?
│   ├── Оркестратор деплоя ──► .github/workflows/deploy.yml
│   ├── SSH-деплой на сервер ──► .github/workflows/deploy-server.yml
│   └── Прод Docker Compose ──► docker-compose.prod.yml
│
└── Настройка Telegram уведомлений и секретов?
    ├── Топики чата (CI, Deploy, Releases, Changelog) ──► docs/devops/monitoring/telegram-alerts.md
    └── Переменные и секреты ──► GitHub Settings -> Secrets and variables -> Actions
```

---

## 📁 Структура разделов

### 1. [Локальная инфраструктура](./infrastructure/local-docker.md)
* [Docker Compose (PostgreSQL, Redis, MinIO S3)](./infrastructure/local-docker.md)
* [Команды управления `infra:up` и `infra:down`](./infrastructure/local-docker.md#команды-управления)

### 2. [CI/CD Пайплайны](./ci-cd/pipelines.md)
* [Архитектура GitHub Actions и paths-filter](./ci-cd/pipelines.md)
* [Модульные Reusable Workflows](./ci-cd/pipelines.md#reusable-workflows)
* [Релизы и сборка артефактов по тегам](./ci-cd/releases.md)

### 3. [Деплой и Production](./deployment/production.md)
* [Production стек (`docker-compose.prod.yml`)](./deployment/production.md)
* [Multi-stage Dockerfile паттерны](./deployment/production.md#dockerfiles)
* [SSH Деплой на сервер и миграции БД](./deployment/production.md#процесс-деплоя)

### 4. [Мониторинг и Алерты](./monitoring/telegram-alerts.md)
* [Telegram-бот и разделение по топикам чата](./monitoring/telegram-alerts.md)
* [Спецификация GitHub Secrets](./monitoring/telegram-alerts.md#github-secrets)
