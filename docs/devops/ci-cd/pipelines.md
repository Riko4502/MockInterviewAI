# CI/CD Пайплайны (GitHub Actions)

Система непрерывной интеграции и доставки (CI/CD) монорепозитория построена на базе **GitHub Actions** с использованием модульного паттерна **Reusable Workflows**.

---

## 1. Архитектура CI (`.github/workflows/ci.yml`)

Главный оркестратор `ci.yml` оптимизирует время выполнения проверок с помощью умной фильтрации путей (`dorny/paths-filter`):

```
                                  ┌──────────────────────────┐
                                  │   Push / Pull Request    │
                                  └────────────┬─────────────┘
                                               │
                                               ▼
                                  ┌──────────────────────────┐
                                  │     paths-filter         │
                                  │ (Определение изменений)  │
                                  └────────────┬─────────────┘
                                               │
               ┌───────────────────────────────┼───────────────────────────────┐
               ▼                               ▼                               ▼
    ┌──────────────────────┐        ┌──────────────────────┐        ┌──────────────────────┐
    │     ci-web.yml       │        │     ci-api.yml       │        │   ci-realtime.yml    │
    │ - Biome lint         │        │ - Zod DTO build      │        │ - Go test            │
    │ - TypeScript check   │        │ - Prisma validation  │        │ - golangci-lint      │
    │ - Vitest / React RTL │        │ - NestJS Jest tests  │        │ - govulncheck        │
    │ - Next.js build      │        │ - Turbo build        │        │                      │
    └──────────┬───────────┘        └──────────┬───────────┘        └──────────┬───────────┘
               │                               │                               │
               └───────────────────────────────┼───────────────────────────────┘
                                               │
                                               ▼
                                  ┌──────────────────────────┐
                                  │  ci-security.yml         │
                                  │  - TruffleHog (Секреты)  │
                                  └────────────┬─────────────┘
                                               │
                                               ▼
                                  ┌──────────────────────────┐
                                  │ notify-ci-telegram.yml   │
                                  │ (Тихий отчет в Telegram) │
                                  └──────────────────────────┘
```

---

## 2. Модульные Workflows (Reusable Workflows)

Каждый сервис изолирован в отдельный переиспользуемый workflow:

| Workflow | Назначение | Ключевые проверки |
| :--- | :--- | :--- |
| **`ci-web.yml`** | Фронтенд (Next.js) | Biome, Typecheck, Vitest, Turbo build, pnpm audit |
| **`ci-api.yml`** | Бэкенд (NestJS) | Prisma validate, Jest unit-тесты, компиляция DTO, Turbo build |
| **`ci-realtime.yml`** | Realtime (Go) | Go test, golangci-lint, govulncheck (поиск уязвимостей в Go пакетах) |
| **`ci-security.yml`** | Безопасность | Сканирование всех коммитов на случайную утечку паролей и API-ключей (TruffleHog) |
| **`notify-ci-telegram.yml`** | Алертинг | Сводный отчет в топик CI с иконками статусов каждого сервиса |

---

## 3. Оптимизация и Кэширование

1. **`actions/cache`**: кэширование артефактов Turborepo (`.turbo/`) сокращает время сборки с минут до секунд.
2. **`pnpm/action-setup`** с флагом `cache: 'pnpm'`: зависимости из `pnpm-lock.yaml` кэшируются между раннерами.
3. **`concurrency`**: отменяет предыдущие устаревшие билды при пуше новых коммитов в ту же ветку (`cancel-in-progress: true`).
