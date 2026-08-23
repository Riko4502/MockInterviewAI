# CI/CD Архитектура и Roadmap

В этом документе описана текущая архитектура пайплайнов CI/CD в monorepo, а также детальный план дальнейшего развития систем тестирования, безопасности, производительности и автоматизации релизов.

---

## 📌 1. Текущая архитектура (Status Quo)

Пайплайны организованы по модульному принципу (**Reusable Workflows**) в `.github/workflows/`:

```text
.github/workflows/
├── ci.yml                     # Главный оркестратор CI (фильтрация путей paths-filter)
├── ci-realtime.yml            # Тесты Go, govulncheck, golangci-lint
├── ci-web.yml                 # Biome lint, TypeScript typecheck, Vitest, build Next.js, pnpm audit
├── ci-api.yml                 # Тесты и сборка Nest.js
├── ci-security.yml            # Поиск утечек секретов (TruffleHog)
├── notify-ci-telegram.yml     # Тихие уведомления в Telegram со статусом проверок (HTML)
├── deploy.yml                 # Главный оркестратор деплоя (workflow_dispatch)
├── deploy-build-realtime.yml  # Сборка и пуш Docker-образа Realtime (GHCR)
├── deploy-build-web.yml       # Сборка и пуш Docker-образа Web (GHCR)
├── deploy-build-api.yml       # Сборка и пуш Docker-образа API (GHCR)
├── deploy-server.yml          # SSH-деплой на сервер (pull, prisma migrate, health checks)
└── notify-deploy-telegram.yml # Тихие уведомления в Telegram о результатах деплоя
```

---

## 🛡️ 2. Безопасность и Качество кода (Quality & Security) [✅ Реализовано]

### 2.1. GitHub CodeQL (SAST-анализ) [✅]
- **Файл:** `.github/workflows/codeql.yml`
- **Назначение:** Статический анализ исходного кода на наличие уязвимостей (SQL-инъекции, XSS, небезопасные горутины, утечки памяти).
- **Стек:** TypeScript/JavaScript (`apps/web`, `apps/api`) и Go (`apps/realtime`).
- **Как работает:** Анализирует код в фоновом режиме на каждый Pull Request в `main`/`dev`, push и еженедельно по расписанию (cron). Результаты передаются во вкладку *GitHub Security Alerts*.

### 2.2. Trivy (Сканирование Docker-образов) [✅]
- **Файлы:** `.github/workflows/deploy-build-*.yml`
- **Назначение:** Проверка базовых Linux-образов и установленных пакетов на наличие известных CVE.
- **Интеграция:** Автоматически запускается в `deploy-build-api.yml`, `deploy-build-web.yml`, `deploy-build-realtime.yml` при сборке образов, формирует детальный аудит уязвимостей (`CRITICAL`, `HIGH`).

### 2.3. Валидация Prisma и целостности схемы БД [✅]
- **Файл:** `.github/workflows/ci-api.yml`
- **Назначение:** Предотвращение рассинхронизации схемы базы данных и моделей приложения.
- **Шаги в CI:**
  1. `pnpm --filter api exec prisma validate` — проверка синтаксиса и структуры `schema.prisma`.
  2. `pnpm --filter api run db:generate` — генерация актуального Prisma Client перед тестами и сборкой.

---

## ⚡ 3. Производительность и Бандл фронтенда (Frontend Health)

### 3.1. Lighthouse CI (Core Web Vitals)
- **Назначение:** Автоматический аудит веб-страниц Next.js по ключевым метрикам:
  - **Performance:** LCP, CLS, FID/INP, TTFB.
  - **Accessibility:** Контрастность, доступность для скринридеров, ARIA-метки.
  - **Best Practices & SEO:** HTTPS, мета-теги, OpenGraph, валидный HTML.
- **Интеграция:** Запуск `lhci autorun` против собранного продакшн-бандла Next.js в PR.

### 3.2. Bundle Size Tracker (@next/bundle-analyzer)
- **Назначение:** Контроль размера JavaScript и CSS бандлов.
- **Польза:** Предупреждает о случайном импорте тяжелых библиотек в клиентские компоненты (демонстрирует `+Δ KB` к размеру страницы).

---

## 🤖 4. Автоматизация Pull Request и Репозитория

### 4.1. Conventional Commits & Semantic PRs
- **Назначение:** Проверка заголовков PR на соответствие формату:
  - `feat: ...` — новая функциональность
  - `fix: ...` — исправление бага
  - `refactor: ...` — рефакторинг кода
  - `chore: ...` — служебные задачи / зависимости
  - `docs: ...` — документация

### 4.2. PR Labeler & Auto-assign
- **Назначение:** Автоматическая расстановка меток на основе измененных путей:
  - `apps/web/**` $\rightarrow$ `🎨 frontend`
  - `apps/api/**` $\rightarrow$ `⚙️ backend`
  - `apps/realtime/**` $\rightarrow$ `⚡ realtime`
  - `.github/**` $\rightarrow$ `🛠️ devops / ci`
- Назначение ответственных ревьюеров в зависимости от затрагиваемого сервиса.

### 4.3. Storybook CI / Визуальное регрессионное тестирование
- **Назначение:** Сборка UI Kit (`packages/ui`) в Storybook и валидация отображения общих компонентов.

### 4.4. PR Sticky Status Comment
- **Назначение:** Формирование одного сводного закрепленного комментария под PR со статусом всех сборок, тестов и ссылками на деплой.

---

## 📦 5. Релизы и версионирование (Release Automation)

### 5.1. Автоматический расчет версий (SemVer)
- Анализ префиксов коммитов/PR:
  - `fix:` $\rightarrow$ Patch (`v1.0.1`)
  - `feat:` $\rightarrow$ Minor (`v1.1.0`)
  - `feat!:` / `BREAKING CHANGE:` $\rightarrow$ Major (`v2.0.0`)

### 5.2. Генерация Changelog и Release Notes
- Автоматическая группировка изменений по категориям (Новые функции, Исправления, Инфраструктура) при публикации тега на GitHub.

### 5.3. Telegram Release Announcement
- Отправка красивого поста в канал команды/пользователей с описанием релиза, списком фич и ссылками.

---

## 🌐 6. Превью-стенды (Preview Environments)

- Создание временных изолированных стендов для каждого Pull Request для ручной проверки и тестирования до мержа в `main`/`dev`.
