# Contributing --- MockInterviewAI

## Назначение

Этот документ описывает правила локальной разработки и внесения
изменений во frontend-приложение `apps/web` проекта **MockInterviewAI**.

Проект организован как **pnpm workspace + Turborepo**.

------------------------------------------------------------------------

## Быстрый старт

После клонирования репозитория зависимости устанавливаются из корня
monorepo:

``` bash
pnpm install
```

Frontend находится в:

``` text
apps/web
```

Для ежедневной работы можно выполнять команды непосредственно из
`apps/web` либо запускать их из корня monorepo через `--filter web`.

------------------------------------------------------------------------

## Основные команды frontend

### Из `apps/web`

``` bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm format
```

  Команда              Назначение
  -------------------- --------------------------------------
  `pnpm dev`           запуск Next.js в development-режиме
  `pnpm build`         production-сборка приложения
  `pnpm start`         запуск production-сборки
  `pnpm lint`          полная проверка frontend через Biome
  `pnpm format`        форматирование frontend через Biome
  `pnpm lint-staged`   ручной запуск проверки staged-файлов

### Из корня monorepo

Те же scripts можно запустить через workspace filter:

``` bash
pnpm --filter web dev
pnpm --filter web build
pnpm --filter web start
pnpm --filter web lint
pnpm --filter web format
```

`lint-staged` обычно вручную запускать не требуется: он вызывается
автоматически через pre-commit hook.

------------------------------------------------------------------------

## Работа с зависимостями

Frontend-зависимости устанавливаются в workspace `web`.

Из корня monorepo:

``` bash
pnpm --filter web add <package>
```

Dev dependency:

``` bash
pnpm --filter web add -D <package>
```

Если терминал уже находится в `apps/web`:

``` bash
pnpm add <package>
```

или:

``` bash
pnpm add -D <package>
```

Зависимость должна добавляться в `apps/web/package.json`, если она
используется непосредственно frontend-приложением.

Не создавайте внутри `apps/web` отдельные:

``` text
pnpm-lock.yaml
pnpm-workspace.yaml
```

Для monorepo используется общий workspace и общий lock-файл.

------------------------------------------------------------------------

## Добавление новой библиотеки

Перед добавлением новой зависимости необходимо проверить:

-   нет ли в проекте библиотеки с той же ответственностью;
-   нельзя ли решить задачу средствами уже используемого стека;
-   является ли пакет runtime dependency или dev dependency;
-   не противоречит ли библиотека существующим архитектурным решениям.

Если для библиотеки появляются проектные правила использования, они
фиксируются в:

``` text
apps/web/docs/guidelines/
```

Guideline описывает не документацию самой библиотеки, а правила её
использования именно в **MockInterviewAI**.

Например:

``` text
guidelines/
├── clsx.md
├── tanstack-query.md
├── zustand.md
├── react-hook-form-zod.md
└── socket-io-client.md
```

------------------------------------------------------------------------

## Качество кода

Для linting и formatting frontend используется **Biome**.

Не добавляйте ESLint или Prettier параллельно без отдельного
архитектурного решения.

### Проверка кода

Из `apps/web`:

``` bash
pnpm lint
```

Из корня monorepo:

``` bash
pnpm --filter web lint
```

Script запускает:

``` bash
biome check
```

Проверяется весь frontend-код согласно `apps/web/biome.json`.

### Форматирование

Из `apps/web`:

``` bash
pnpm format
```

Из корня monorepo:

``` bash
pnpm --filter web format
```

Script запускает:

``` bash
biome format --write
```

Biome форматирует файлы в соответствии с конфигурацией проекта.

------------------------------------------------------------------------

## Pre-commit проверки

Git hooks запускаются через **Husky**.

Перед созданием commit выполняется цепочка:

``` text
git commit
    ↓
Husky
    ↓
lint-staged
    ↓
Biome
```

`lint-staged` передаёт Biome только файлы, добавленные в staging area.

Это позволяет не запускать полную проверку frontend при каждом commit.

Если обязательная проверка завершается ошибкой, commit не создаётся.

Husky и `lint-staged` вручную запускать перед каждым commit не
требуется.

------------------------------------------------------------------------

## Полная проверка и pre-commit --- не одно и то же

Pre-commit:

``` text
lint-staged
    ↓
Biome
    ↓
только staged-файлы
```

Полная проверка:

``` bash
pnpm lint
```

проверяет frontend целиком.

`lint-staged` не заменяет полную проверку проекта.

Перед MR/PR рекомендуется выполнить:

``` bash
pnpm lint
pnpm build
```

------------------------------------------------------------------------

## Git workflow

Перед началом новой задачи обновите `main` и создайте отдельную ветку:

``` bash
git checkout main
git pull origin main
git checkout -b feat/<task-name>
```

После выполнения задачи:

``` bash
git add .
git commit -m "feat: ..."
```

Изменения в `main` вносятся через отдельную ветку и MR/PR.

------------------------------------------------------------------------

## Названия веток

Используйте префикс, соответствующий типу изменения:

``` text
feat/       новая функциональность
fix/        исправление ошибки
refactor/   рефакторинг
docs/       документация
test/       тесты
chore/      инфраструктурные и служебные изменения
```

Примеры:

``` text
feat/shared-ui-stack
fix/interview-loading
docs/frontend-guidelines
refactor/auth-form
```

------------------------------------------------------------------------

## Commit messages

Используем **Conventional Commits**.

Основные типы:

``` text
feat      новая функциональность
fix       исправление ошибки
refactor  изменение структуры кода без изменения поведения
test      добавление или изменение тестов
docs      документация
chore     инфраструктурные и служебные изменения
```

Примеры:

``` bash
git commit -m "feat: add Stack component"
git commit -m "fix: handle interview loading state"
git commit -m "docs: add clsx guideline"
git commit -m "refactor: simplify interview form"
```

------------------------------------------------------------------------

## Frontend-архитектура

Frontend следует **Feature-Sliced Design (FSD)** с адаптацией под
Next.js App Router.

Базовая структура:

``` text
src/
├── app/
├── widgets/
├── features/
├── entities/
└── shared/
```

Next.js routing находится в:

``` text
src/app/
```

Переиспользуемые UI-примитивы:

``` text
src/shared/ui/
```

Общая инфраструктура и переиспользуемые утилиты располагаются в
соответствующих сегментах `shared`.

`shared` не должен содержать бизнес-логику конкретной feature или
entity.

------------------------------------------------------------------------

## UI и стили

Основной способ стилизации frontend --- **Tailwind CSS**.

Если компонент полностью стилизуется Tailwind, отдельный CSS/SCSS Module
создавать не нужно.

Статические классы:

``` tsx
<div className="flex items-center gap-4" />
```

Для динамического формирования `className` используется `clsx`:

``` tsx
className={clsx(
    'flex',
    directionClasses[direction],
    gap && gapClasses[gap],
    wrap && 'flex-wrap',
    className,
)}
```

Правила использования конкретных библиотек фиксируются в
`docs/guidelines`.

------------------------------------------------------------------------

## State management

Server state и client state разделяются.

``` text
API / server state
        ↓
TanStack Query

UI / client state
        ↓
Zustand
```

### TanStack Query

Используется для:

-   API-запросов;
-   кеширования;
-   mutations;
-   invalidation;
-   server loading/error state.

### Zustand

Используется для глобального client/UI state, если локального React
state недостаточно.

Не дублируйте server state из TanStack Query в Zustand без отдельной
архитектурной причины.

------------------------------------------------------------------------

## Формы и валидация

Для форм используется:

``` text
React Hook Form
        +
       Zod
```

`react-hook-form` отвечает за состояние формы.

`zod` отвечает за validation schema и runtime validation.

`@hookform/resolvers` используется для их интеграции.

Ошибки валидации формы должны отображаться в контексте соответствующих
полей, а не заменяться глобальными уведомлениями.

------------------------------------------------------------------------

## Realtime

Для realtime-взаимодействия используется:

``` text
socket.io-client
```

Создание соединений и управление их lifecycle должны быть
централизованы.

Не создавайте независимое socket-соединение в каждом feature-компоненте.

Для обычных HTTP-запросов используется API-слой и TanStack Query, а не
Socket.IO.

------------------------------------------------------------------------

## Тестирование

Для unit/component тестирования используются:

-   Vitest;
-   React Testing Library;
-   `@testing-library/jest-dom`;
-   `@testing-library/user-event`;
-   jsdom.

Тесты должны проверять пользовательское поведение, а не внутренние
детали реализации компонента.

Предпочтительно искать элементы по доступным пользователю признакам:

-   role;
-   label;
-   text;
-   другим семантическим селекторам.

Не привязывайте тест к Tailwind-классам, если конкретный класс не
является частью проверяемого поведения.

------------------------------------------------------------------------

## Что не коммитить

В Git не должны попадать генерируемые директории:

``` text
.next/
node_modules/
coverage/
```

Внутри `apps/web` не создаются и не коммитятся отдельные:

``` text
pnpm-lock.yaml
pnpm-workspace.yaml
```

Для всего monorepo используется один workspace и один lock-файл.

------------------------------------------------------------------------

## Документация

Документация frontend хранится в:

``` text
apps/web/docs/
```

Разделение ответственности:

``` text
docs/
├── CONTRIBUTING.md
├── DECISIONS.md
├── FRONTEND_INFRASTRUCTURE.md
└── guidelines/
```

### CONTRIBUTING.md

Отвечает на вопрос:

> Как разработчику работать с проектом?

Здесь находятся команды, Git workflow, правила зависимостей, проверки и
основные conventions.

### FRONTEND_INFRASTRUCTURE.md

Отвечает на вопрос:

> Как технически устроен frontend?

Здесь описываются monorepo, инструменты, архитектура и инфраструктурные
решения.

### guidelines/

Отвечает на вопрос:

> Как конкретная библиотека или инструмент используется именно в
> MockInterviewAI?

Guidelines не должны пересказывать официальную документацию библиотек.

### DECISIONS.md

Используется для фиксации значимых технических и архитектурных решений
проекта.

------------------------------------------------------------------------

## Перед MR / PR

-   [ ] Изменения находятся в корректном FSD-слое.
-   [ ] Нет дублирования существующих компонентов или утилит.
-   [ ] Новая dependency действительно необходима.
-   [ ] Для новой библиотеки при необходимости добавлен guideline.
-   [ ] Server state не дублируется в Zustand.
-   [ ] `pnpm lint` проходит успешно.
-   [ ] `pnpm build` проходит успешно.
-   [ ] Генерируемые файлы не попали в commit.
-   [ ] Commit message соответствует Conventional Commits.
-   [ ] Документация обновлена, если изменение вводит новое проектное
    правило.
