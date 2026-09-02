# Сборка и команды (Build & Tooling)

Вся сборка монорепозитория управляется через **Turborepo** и **pnpm workspaces**.

---

## 1. Основные команды

| Действие | Команда |
|---|---|
| **Установка всех зависимостей** | `pnpm install` |
| **Запуск всего в dev-режиме** | `pnpm dev` |
| **Запуск только веб-приложения** | `pnpm dev:web` |
| **Сборка всего проекта (Production build)** | `pnpm build` |
| **Сборка UI Kit** | `pnpm --filter @packages/ui build` |
| **Сборка только Web** | `pnpm --filter web build` |
| **Проверка типов (Typecheck)** | `pnpm typecheck` |
| **Генерация OpenAPI / Swagger (бэкенд, без Docker)** | `pnpm run generate:api` |
| **Генерация TypeScript-типов API (@packages/api)** | `pnpm --filter @packages/api generate` |
| **Проверка линтером (Biome)** | `pnpm --filter web lint` |
| **Автоформатирование кода** | `pnpm --filter web format` |

---

## 2. Граф зависимостей сборки (Turborepo)

Turborepo гарантирует, что зависимые пакеты соберутся перед сборкой приложений:

```text
web#build
  ├── @packages/ui#build
  └── @packages/api#build
```

---

## 3. ⚠️ Важное примечание по окружению для `pnpm build`

* Команда **`pnpm build`** запускает полную сборку **всех** приложений монорепозитория, включая WebSocket-сервис на Go (`@apps/realtime`).
* Для успешного выполнения `pnpm build` и `pnpm test` на машине **должен быть установлен Go (Golang) >= 1.26+**.
* Если у фронтенд-разработчика **не установлен Go**, используйте команды изолированной сборки фронтенда:
  ```bash
  # Сборка только веб-приложения Next.js
  pnpm --filter web build
  # или:
  pnpm run build:web
  ```
