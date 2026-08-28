# Frontend Documentation

Добро пожаловать в техническую документацию фронтенда платформы! Здесь собраны правила, стандарты, примеры и архитектурные решения.

---

## ⚡ Шпаргалка: Куда положить код? (Decision Tree)

```text
Какой тип кода вы создаете?
├── Базовый UI элемент (Button, Modal, Input, Badge)?
│   ├── Есть в shadcn/ui? ──► Добавить в @packages/ui через CLI
│   ├── Кастомный и нужен в разных приложениях? ──► Создать в @packages/ui + Storybook
│   └── Специфичен для одной страницы web? ──► apps/web/src/shared/ui
│
├── Доменная сущность (User, Session, Feedback, карточка пользователя)?
│   └── apps/web/src/entities/<entity-name>
│
├── Пользовательский интерактивный сценарий (LoginByEmail, RequestAiHint, StartSession)?
│   └── apps/web/src/features/<feature-name>
│
├── Крупный составной блок страницы (Sidebar, CodeEditorWorkspace, Navbar)?
│   └── apps/web/src/widgets/<widget-name>
│
├── Маршрут / Страница?
│   ├── Тонкий роут App Router ──► apps/web/src/app/(routes)/...
│   └── Композиция страницы ──► apps/web/src/pages/<page-name>
│
└── Общая утилита, хук или клиент без бизнес-логики?
    └── apps/web/src/shared/(lib|hooks|types|config)
```

---

## 📁 Структура разделов

### 1. [Архитектура](./architecture/overview.md)
* [Обзор архитектуры](./architecture/overview.md)
* [Feature-Sliced Design (FSD)](./architecture/fsd.md)
* [Next.js App Router интеграция](./architecture/nextjs.md)
* [Astro Landing](./architecture/astro.md)
* [Интернационализация (i18n)](./i18n.md)

### 2. [UI и дизайн-система](./ui/ui-kit.md)
* [UI Kit & shadcn/ui](./ui/ui-kit.md)
* [Стилизация и Tailwind CSS](./ui/styling.md)
* [Storybook стандарты](./ui/storybook.md)

### 3. [Данные и управление состоянием](./data/state-management.md)
* [API Contracts & OpenAPI](./data/api-contracts.md)
* [TanStack Query](./data/tanstack-query.md)
* [State Management Decision Tree](./data/state-management.md)
* [Realtime Integration (WS & SSE)](./data/realtime.md)


### 4. [Разработка и качество](./development/typescript.md)
* [TypeScript стандарты](./development/typescript.md)
* [Тестирование](./development/testing.md)
* [Сборка и команды](./development/build.md)
* [Зависимости](./development/dependencies.md)

### 5. [Процессы](./processes/pull-request.md)
* [Pull Request Policy](./processes/pull-request.md)
* [Архитектурные решения (ADR)](./processes/adr.md)
