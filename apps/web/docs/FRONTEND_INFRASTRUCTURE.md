# Frontend Infrastructure Guide --- MockInterviewAI

## 1. Назначение документа

Этот документ описывает базовую инфраструктуру frontend-приложения
`apps/web` в monorepo **MockInterviewAI**: какие инструменты
используются, почему они выбраны, где находятся конфигурации и как с
ними работать.

Цель --- чтобы любой разработчик мог клонировать проект, установить
зависимости и понимать, какие автоматические проверки выполняются
локально и перед коммитом.

------------------------------------------------------------------------

## 2. Структура monorepo

Проект организован как **pnpm workspace + Turborepo**.

``` text
MockInterviewAI/
├── .husky/
│   └── pre-commit
├── apps/
│   ├── api/
│   ├── code-runner/
│   ├── realtime/
│   └── web/
├── packages/
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── turbo.json
```

Корневой `pnpm-workspace.yaml` определяет workspace:

``` yaml
packages:
  - "apps/*"
  - "packages/*"
```

Поэтому `apps/web` является частью общего monorepo, а не самостоятельным
pnpm-проектом.

### Важно

Внутри `apps/web` не должны находиться собственные:

``` text
pnpm-lock.yaml
pnpm-workspace.yaml
```

Также `apps/web/package.json` не должен фиксировать отдельную версию
pnpm через `packageManager`.

Версия package manager определяется в корневом `package.json`:

``` json
{
  "packageManager": "pnpm@9.0.0"
}
```

Это позволяет всем разработчикам и CI использовать согласованную версию
pnpm для всего monorepo.

------------------------------------------------------------------------

## 3. Frontend stack

Frontend находится в:

``` text
apps/web
```

Основной стек:

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

Архитектурная методология:

-   Feature-Sliced Design (FSD)

Инфраструктура репозитория:

-   pnpm
-   Turborepo
-   Husky
-   lint-staged
-   CI pipeline

------------------------------------------------------------------------

## 4. Почему используется Biome

Первоначально требования предполагали ESLint + Prettier, но для проекта
принято решение использовать **Biome**.

Biome объединяет несколько задач:

``` text
Biome
├── lint
├── format
└── code checks / fixes
```

Это позволяет не поддерживать одновременно ESLint и Prettier и уменьшает
количество конфигураций и зависимостей.

Конфигурация находится в:

``` text
apps/web/biome.json
```

Biome установлен как dev dependency frontend-приложения.

------------------------------------------------------------------------

## 5. Команды Biome

В `apps/web/package.json` определены команды:

``` json
{
  "scripts": {
    "lint": "biome check",
    "format": "biome format --write"
  }
}
```

### Проверка проекта

Из корня monorepo:

``` bash
pnpm --filter web lint
```

Команда запускает:

``` bash
biome check
```

Она проверяет frontend-код согласно конфигурации Biome.

Команда не предназначена для массового автоматического изменения проекта
и подходит для полной проверки frontend.

### Форматирование проекта

``` bash
pnpm --filter web format
```

Запускается:

``` bash
biome format --write
```

`--write` означает, что Biome автоматически перезапишет файлы в
соответствии с правилами форматирования.

Эту команду можно использовать вручную, когда необходимо отформатировать
весь frontend.

------------------------------------------------------------------------

## 6. Husky

Husky используется для запуска автоматических проверок на Git hooks.

Husky установлен **в корне monorepo**, потому что Git-репозиторий общий
для всех приложений:

``` text
MockInterviewAI/
├── .git/
├── .husky/
└── apps/
```

Он не должен устанавливаться отдельно внутри `apps/web`.

После установки Husky в корневом `package.json` используется:

``` json
{
  "scripts": {
    "prepare": "husky"
  }
}
```

`prepare` обеспечивает настройку Git hooks после установки зависимостей.

------------------------------------------------------------------------

## 7. Pre-commit hook

Файл:

``` text
.husky/pre-commit
```

запускается Git непосредственно перед созданием commit.

В проекте он вызывает:

``` sh
pnpm lint-staged
```

Общая цепочка:

``` text
git commit
    ↓
Git pre-commit hook
    ↓
Husky
    ↓
lint-staged
    ↓
Biome
```

Если обязательная проверка завершается ошибкой, commit не создаётся.

------------------------------------------------------------------------

## 8. Зачем нужен lint-staged

Без `lint-staged` можно было бы написать:

``` sh
pnpm --filter web lint
```

непосредственно в Husky.

Но тогда при каждом commit Biome проверял бы весь `apps/web`, даже если
разработчик изменил только один файл.

Например:

``` text
apps/web
├── 1000 файлов
└── изменён только login-form.tsx
```

Полная проверка каждый раз становится избыточной по мере роста проекта.

`lint-staged` работает только с файлами, которые были добавлены в Git
staging area:

``` bash
git add ...
```

Поэтому схема становится:

``` text
изменённые файлы
      ↓
git add
      ↓
staged files
      ↓
git commit
      ↓
Husky
      ↓
lint-staged
      ↓
Biome только для staged-файлов
```

Это ускоряет pre-commit проверки.

------------------------------------------------------------------------

## 9. Biome + lint-staged

Для staged frontend-файлов рекомендуется запускать Biome с
автоматическим исправлением:

``` bash
biome check --write
```

Таким образом перед commit Biome может:

-   проверить код;
-   исправить поддерживаемые проблемы;
-   применить форматирование;
-   остановить commit, если остаются ошибки, которые нельзя корректно
    исправить автоматически.

Конфигурацию `lint-staged` следует хранить централизованно в корне
monorepo, например:

``` text
MockInterviewAI/
├── lint-staged.config.mjs
├── .husky/
│   └── pre-commit
└── apps/
    └── web/
        └── biome.json
```

Пример:

``` js
export default {
  "apps/web/**/*.{js,jsx,ts,tsx,json,css}": [
    "pnpm --filter web exec biome check --write --no-errors-on-unmatched",
  ],
}
```

Если фактическая конфигурация проекта отличается, источником истины
является конфигурационный файл в репозитории.

------------------------------------------------------------------------

## 10. Как происходит обычный commit

Разработчик работает как обычно:

``` bash
git add .
git commit -m "feat: add interview form"
```

После `git commit` автоматически происходит:

``` text
1. Git вызывает pre-commit
2. Husky запускает pnpm lint-staged
3. lint-staged определяет staged-файлы
4. Для frontend-файлов запускается Biome
5. Biome выполняет проверки и разрешённые auto-fix
6. Если всё успешно — commit создаётся
7. Если проверка не прошла — commit блокируется
```

Не нужно вручную запускать Husky.

------------------------------------------------------------------------

## 11. Полная проверка frontend

`lint-staged` предназначен для быстрых локальных проверок текущего
commit.

Он **не заменяет полную проверку проекта**.

Для проверки всего frontend:

``` bash
pnpm --filter web lint
```

В дальнейшем полная проверка должна выполняться в CI.

Принцип:

``` text
LOCAL / PRE-COMMIT

Husky
↓
lint-staged
↓
Biome + auto-fix
↓
только staged-файлы


CI

Biome check
↓
весь frontend
↓
без автоматического исправления
↓
ошибка → pipeline failed
```

CI не должен автоматически исправлять присланный код. Его задача ---
проверить, соответствует ли commit требованиям проекта.

------------------------------------------------------------------------

## 12. Установка frontend-зависимостей

Зависимости frontend устанавливаются из корня monorepo через filter:

``` bash
pnpm --filter web add <package>
```

Например:

``` bash
pnpm --filter web add @tanstack/react-query
```

Dev dependency:

``` bash
pnpm --filter web add -D vitest
```

Не нужно переходить в `apps/web` и создавать отдельный workspace.

------------------------------------------------------------------------

## 13. Runtime-зависимости из frontend stack

Основные рабочие библиотеки:

``` bash
pnpm --filter web add @tanstack/react-query zustand react-hook-form zod @hookform/resolvers socket.io-client
```

Назначение:

  Package                   Ответственность
  ------------------------- -------------------------------------
  `@tanstack/react-query`   server state, запросы и кеширование
  `zustand`                 client state
  `react-hook-form`         управление формами
  `zod`                     runtime validation и схемы
  `@hookform/resolvers`     интеграция React Hook Form + Zod
  `socket.io-client`        realtime-соединение

### Правило state management

Не следует дублировать server state в Zustand.

``` text
API/server state
      ↓
TanStack Query

UI/client state
      ↓
Zustand
```

------------------------------------------------------------------------

## 14. Тестирование

Для unit/component тестов используется:

-   Vitest
-   React Testing Library
-   `@testing-library/jest-dom`
-   `@testing-library/user-event`
-   jsdom

Установка:

``` bash
pnpm --filter web add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Тестовая инфраструктура настраивается отдельно от установки пакетов.

------------------------------------------------------------------------

## 15. Tailwind и shadcn/ui

Tailwind CSS установлен вместе с Next.js.

Для UI Kit используется shadcn/ui.

Компоненты UI Kit должны быть интегрированы с архитектурой FSD и
располагаться в общем UI-слое, а не хаотично внутри features.

Планируемое расположение:

``` text
src/shared/ui/
```

Поэтому инициализацию shadcn следует выполнять после создания
FSD-структуры и настройки aliases.

------------------------------------------------------------------------

## 16. FSD

Frontend следует методологии Feature-Sliced Design.

Планируемая базовая структура:

``` text
src/
├── app/
├── widgets/
├── features/
├── entities/
└── shared/
```

Next.js App Router использует `src/app` для routing, поэтому структура
FSD адаптируется под Next.js и не должна механически копировать
структуру обычного SPA.

Архитектурные правила и ограничения импортов настраиваются отдельным
этапом.

------------------------------------------------------------------------

## 17. Что не нужно коммитить

Генерируемые директории вроде:

``` text
.next/
node_modules/
coverage/
```

не должны попадать в Git.

Также внутри `apps/web` не создаются отдельные:

``` text
pnpm-lock.yaml
pnpm-workspace.yaml
```

Для monorepo используется один workspace и один lock-файл в корне.

------------------------------------------------------------------------

## 18. Быстрый старт для нового разработчика

После клонирования репозитория:

``` bash
pnpm install
```

Запуск frontend:

``` bash
pnpm --filter web dev
```

Полная проверка frontend:

``` bash
pnpm --filter web lint
```

Форматирование всего frontend:

``` bash
pnpm --filter web format
```

Обычная работа с Git:

``` bash
git add .
git commit -m "feat: ..."
```

Pre-commit проверки выполняются автоматически через Husky.

------------------------------------------------------------------------

## 19. Принципы инфраструктуры

При развитии frontend придерживаемся следующих правил:

1.  Все приложения остаются частью общего pnpm workspace.
2.  Версия pnpm определяется на уровне root monorepo.
3.  Biome является единым инструментом linting/formatting frontend.
4.  Не добавляем ESLint/Prettier параллельно без отдельного
    архитектурного решения.
5.  Husky отвечает за запуск Git hooks.
6.  lint-staged отвечает за выбор файлов текущего commit.
7.  Biome отвечает за проверку, форматирование и поддерживаемые
    auto-fix.
8.  Pre-commit должен быть быстрым.
9.  Полные проверки выполняются в CI.
10. CI проверяет код, но не исправляет его автоматически.
11. UI строится на общем UI Kit.
12. Архитектура frontend следует FSD.
13. Server state и client state не смешиваются.

------------------------------------------------------------------------

## 20. Текущий и следующий этапы

На текущем этапе подготовлены или выбраны:

``` text
Next.js + TypeScript
Tailwind CSS
Biome
pnpm workspace
Turborepo
Husky
lint-staged
TanStack Query
Zustand
React Hook Form + Zod
Socket.IO
Vitest + RTL
```

Следующие инфраструктурные этапы:

``` text
FSD structure
→ FSD architecture checks
→ shadcn/ui + UI Kit
→ application providers
→ TanStack Query configuration
→ Zustand conventions
→ Socket.IO infrastructure
→ React Hook Form + Zod conventions
→ Vitest + RTL configuration
→ Storybook
→ Sentry / GlitchTip
→ CI pipeline
```

Документ необходимо актуализировать при изменении инфраструктурных
решений.
