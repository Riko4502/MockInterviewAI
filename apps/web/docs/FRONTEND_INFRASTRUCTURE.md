# Frontend Infrastructure Guide --- MockInterviewAI

## 1. Назначение

Документ описывает техническое устройство frontend-приложения
`apps/web`: основные инструменты, их ответственность, расположение
конфигураций и архитектурные принципы.

Практические правила работы с репозиторием вынесены в `CONTRIBUTING.md`,
а conventions по отдельным библиотекам --- в `docs/guidelines/`.

------------------------------------------------------------------------

## 2. Структура monorepo

Проект организован как **pnpm workspace + Turborepo**.

``` text
MockInterviewAI/
├── .husky/
├── apps/
│   ├── api/
│   ├── code-runner/
│   ├── realtime/
│   └── web/
├── packages/
├── lint-staged.config.mjs
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── turbo.json
```

`apps/web` является частью общего monorepo.

Корневой workspace включает приложения и общие packages:

``` yaml
packages:
  - "apps/*"
  - "packages/*"
```

Внутри `apps/web` не создаются отдельные `pnpm-lock.yaml` и
`pnpm-workspace.yaml`.

------------------------------------------------------------------------

## 3. Frontend stack

Основной стек `apps/web`:

-   Next.js
-   React
-   TypeScript
-   Tailwind CSS
-   Biome
-   TanStack Query
-   Zustand
-   React Hook Form
-   Zod
-   Socket.IO Client
-   Vitest
-   React Testing Library
-   Storybook
-   shadcn/ui

Дополнительные небольшие библиотеки могут использоваться для решения
локальных инфраструктурных задач, например `clsx` для формирования
`className`.

Архитектурная методология:

-   Feature-Sliced Design (FSD)

Инфраструктура monorepo:

-   pnpm
-   Turborepo
-   Husky
-   lint-staged
-   CI pipeline

------------------------------------------------------------------------

## 4. pnpm workspace и Turborepo

Все приложения остаются частью единого workspace.

Зависимость должна принадлежать тому workspace, который непосредственно
её использует.

Turborepo отвечает за orchestration задач monorepo и позволяет
централизованно запускать команды приложений и packages.

------------------------------------------------------------------------

## 5. Biome

Biome является единым инструментом linting и formatting frontend.

Он заменяет параллельное использование ESLint + Prettier и уменьшает
количество конфигураций.

Конфигурация frontend:

``` text
apps/web/biome.json
```

Основные задачи:

``` text
Biome
├── lint
├── format
└── code checks / fixes
```

CI должен проверять код, но не исправлять его автоматически.

------------------------------------------------------------------------

## 6. Husky и lint-staged

Husky находится в корне monorepo, поскольку Git-репозиторий общий.

``` text
MockInterviewAI/
├── .git/
├── .husky/
└── apps/
```

Pre-commit pipeline:

``` text
Git pre-commit
      ↓
Husky
      ↓
lint-staged
      ↓
Biome для staged-файлов
```

`lint-staged` нужен для быстрых локальных проверок и не заменяет полную
проверку frontend.

------------------------------------------------------------------------

## 7. Tailwind CSS и UI

Tailwind CSS является основным способом стилизации frontend.

Переиспользуемые UI-примитивы располагаются в:

``` text
src/shared/ui/
```

Для UI Kit выбран `shadcn/ui`. Его компоненты должны интегрироваться с
FSD, а не размещаться хаотично внутри features.

Собственные layout-примитивы, например `Stack`, также располагаются в
`shared/ui`.

------------------------------------------------------------------------

## 8. FSD

Frontend следует Feature-Sliced Design.

``` text
src/
├── app/
├── widgets/
├── features/
├── entities/
└── shared/
```

Next.js App Router использует `src/app` для routing, поэтому FSD
адаптируется под Next.js и не копируется механически из SPA-проектов.

`shared` содержит инфраструктурный и переиспользуемый код, который не
знает о бизнес-сценариях приложения.

------------------------------------------------------------------------

## 9. Управление состоянием

Ответственность разделена:

``` text
Server state → TanStack Query
Client/UI state → Zustand
```

Server state не должен дублироваться в Zustand.

React Hook Form отвечает за состояние форм, а Zod --- за схемы и runtime
validation.

------------------------------------------------------------------------

## 10. Realtime

Для realtime-взаимодействия используется `socket.io-client`.

Подключение и lifecycle realtime-соединения должны быть централизованы,
чтобы feature-компоненты не создавали независимые соединения без
необходимости.

------------------------------------------------------------------------

## 11. Тестирование

Для unit/component тестов используются:

-   Vitest
-   React Testing Library
-   `@testing-library/jest-dom`
-   `@testing-library/user-event`
-   jsdom

Тестовая инфраструктура настраивается отдельно от runtime-кода.

------------------------------------------------------------------------

## 12. Документация библиотек

Проект не копирует официальную документацию npm-библиотек.

В `docs/guidelines/` фиксируются только проектные conventions:

``` text
docs/guidelines/
├── clsx.md
├── tanstack-query.md
├── zustand.md
├── react-hook-form-zod.md
├── socket-io-client.md
├── testing.md
└── shadcn-ui.md
```

Guideline создаётся, если для библиотеки есть собственные правила
использования, ограничения или архитектурная ответственность.

------------------------------------------------------------------------

## 13. Принципы инфраструктуры

1.  Все приложения являются частью общего pnpm workspace.
2.  Версия pnpm определяется на уровне root monorepo.
3.  Biome --- единый linting/formatting инструмент frontend.
4.  ESLint/Prettier не добавляются параллельно без отдельного решения.
5.  Husky запускает Git hooks.
6.  lint-staged выбирает файлы текущего commit.
7.  Pre-commit должен оставаться быстрым.
8.  Полные проверки выполняются в CI.
9.  CI проверяет код, но не изменяет его.
10. UI строится вокруг общего UI-слоя.
11. Frontend следует FSD.
12. Server state и client state не смешиваются.
13. Проектные conventions по библиотекам документируются отдельно.
