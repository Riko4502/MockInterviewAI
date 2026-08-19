# Frontend Guidelines

## 1. Назначение

Документ определяет архитектурные и инженерные правила разработки Frontend.

Frontend состоит из:

- `web` — основное приложение на Next.js;
- `landing` — публичный Landing на Astro.

Общие переиспользуемые части выносятся в workspace packages:

- `@packages/ui` — UI Kit на Tailwind CSS;
- `@packages/api` — типизированный API client, генерируемый из Swagger/OpenAPI.

---

# 2. Frontend Architecture

```text
apps/
├── web/
│   └── src/
│       ├── app/
│       ├── pages/
│       ├── widgets/
│       ├── features/
│       ├── entities/
│       └── shared/
│
└── landing/

packages/
├── ui/
└── api/
```

### `apps/web`

Основное приложение продукта.

Использует:

- Next.js;
- React;
- TypeScript;
- Feature-Sliced Design;
- TanStack Query;
- Zustand;
- React Hook Form;
- Zod;
- `@packages/ui`;
- `@packages/api`.

### `apps/landing`

Публичное приложение на Astro.

Используется для:

- Landing pages;
- marketing pages;
- SEO;
- публичного контента.

### `packages/ui`

Общий UI Kit на Tailwind CSS.

### `packages/api`

Типизированный API client, генерируемый из Swagger/OpenAPI.

---

# 3. Package Dependencies

Допустимое направление зависимостей:

```text
apps/web
   ├── @packages/ui
   └── @packages/api

apps/landing
   └── @packages/ui
```

Packages не должны зависеть от applications.

Запрещено:

```text
packages/ui → apps/web
packages/api → apps/web
```

Также запрещены циклические зависимости.

---

# 4. Build Architecture

Каждый application и package должен иметь собственный build process.

```text
packages/
├── ui/
│   ├── tsconfig.json
│   └── build
│
└── api/
    ├── generate
    ├── tsconfig.json
    └── build

apps/
├── web/
│   └── build
│
└── landing/
    └── build
```

Каждый package должен иметь собственную TypeScript configuration boundary.

Package не должен зависеть от `tsconfig.json` приложения-потребителя.

API package имеет два отдельных процесса:

```text
Swagger / OpenAPI
        ↓
     generate
        ↓
generated client
        ↓
      build
        ↓
@packages/api
```

Generated code не редактируется вручную.

---

# 5. UI Kit

UI Kit располагается в:

```text
packages/ui
```

Использует:

- React;
- TypeScript;
- Tailwind CSS.

Пример:

```text
packages/ui/
├── src/
│   ├── components/
│   ├── primitives/
│   ├── lib/
│   └── index.ts
├── styles/
├── tailwind.config.*
├── package.json
└── tsconfig.json
```

---

# 6. UI Kit Responsibilities

UI Kit отвечает только за переиспользуемый presentation layer.

Допустимые компоненты:

- Button;
- Input;
- Select;
- Checkbox;
- Radio;
- Modal;
- Dialog;
- Dropdown;
- Tabs;
- Tooltip;
- Table;
- Form primitives;
- Typography;
- Icons;
- Layout primitives;
- design tokens.

UI Kit не должен содержать:

- API requests;
- TanStack Query;
- Zustand;
- business logic;
- authentication;
- authorization;
- domain entities;
- application routing.

---

# 7. Tailwind CSS

Tailwind CSS является основным механизмом стилизации UI Kit.

Общие design tokens должны быть определены централизованно.

Глобальные CSS используются только для:

- CSS variables;
- design tokens;
- reset;
- base styles;
- typography;
- глобальных правил.

---

# 8. UI Kit Public API

Компоненты импортируются только через public API:

```tsx
import { Button, Input, Modal } from '@packages/ui';
```

Запрещено:

```tsx
import { Button } from '@packages/ui/src/components/Button/Button';
```

Внутренняя структура package является implementation detail.

---

# 9. UI Kit Build

UI Kit должен иметь отдельный build script и собственный TypeScript configuration.

```text
packages/ui/
├── src/
├── tsconfig.json
├── package.json
└── ...
```

`packages/ui/tsconfig.json` используется именно для сборки UI Kit и не должен зависеть от `apps/web/tsconfig.json`.

Например:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "isolatedModules": true,
    "noEmit": false
  },
  "include": ["src"]
}
```

Фактическая конфигурация зависит от выбранного build tool.

Build должен:

1. проверить TypeScript;
2. собрать компоненты;
3. сгенерировать declaration files;
4. обработать Tailwind CSS;
5. подготовить package output;
6. сформировать public package entrypoints.

UI Kit должен собираться независимо от `apps/web` и `apps/landing`.

Например:

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json"
  }
}
```

Если используется отдельный bundler, он должен использовать собственную конфигурацию UI Kit.

---

# 10. API Package

API client располагается в:

```text
packages/api
```

Backend Swagger/OpenAPI является источником истины для API contract.

Общий flow:

```text
Backend
   ↓
Swagger / OpenAPI
   ↓
@packages/api
   ↓
Generated TypeScript Client
   ↓
apps/web
```

Frontend не должен вручную дублировать API contract.

---

# 11. API Generation

`packages/api` должен иметь отдельные scripts:

```json
{
  "scripts": {
    "generate": "...",
    "build": "..."
  }
}
```

Процесс:

```text
Swagger / OpenAPI
       ↓
    generate
       ↓
generated/
       ↓
     build
       ↓
@packages/api
```

Generated code не редактируется вручную.

Любое изменение API начинается с изменения Backend contract.

---

# 12. API Package Structure

Рекомендуемая структура:

```text
packages/api/
├── openapi/
│   └── openapi.json
├── src/
│   ├── generated/
│   ├── client/
│   └── index.ts
├── package.json
└── tsconfig.json
```

`generated/` содержит только автоматически сгенерированный код.

---

# 13. API Public API

Приложение использует API только через public API package.

Разрешено:

```ts
import { apiClient } from '@packages/api';
```

Запрещено:

```ts
import { getInterview } from '@packages/api/src/generated/...';
```

---

# 14. API и TanStack Query

`@packages/api` отвечает за:

- API transport;
- generated types;
- API client.

TanStack Query отвечает за server state.

Архитектура:

```text
Component
    ↓
Feature / Entity
    ↓
TanStack Query
    ↓
@packages/api
    ↓
Backend API
```

`@packages/api` не должен содержать:

- Zustand;
- React UI;
- application state;
- business logic.

---

# 15. API Types

Swagger/OpenAPI является источником истины для API types.

Не следует создавать дублирующие API types вручную.

Если API DTO отличается от UI model:

```text
API DTO
   ↓
Mapper
   ↓
UI Model
```

---

# 16. Main Web Application

Основное приложение:

```text
apps/web
```

Использует:

- Next.js;
- React;
- TypeScript;
- Feature-Sliced Design;
- TanStack Query;
- Zustand;
- React Hook Form;
- Zod;
- `@packages/ui`;
- `@packages/api`.

---

# 17. Feature-Sliced Design

`apps/web` использует FSD.

```text
apps/web/src/
├── app/
├── pages/
├── widgets/
├── features/
├── entities/
└── shared/
```

Зависимости:

```text
app
 ↓
pages
 ↓
widgets
 ↓
features
 ↓
entities
 ↓
shared
```

Нижний слой не должен зависеть от верхнего.

---

# 18. App Layer

`app` отвечает за:

- providers;
- layouts;
- routing;
- global configuration;
- global styles;
- error boundaries;
- application initialization.

Пример:

```text
app/
├── providers/
├── styles/
├── config/
├── layout/
└── error/
```

---

# 19. Pages Layer

`pages` отвечает за композицию страниц.

Page объединяет:

- widgets;
- features;
- entities;
- shared UI.

Page не должна содержать сложную бизнес-логику.

---

# 20. Widgets Layer

Widget представляет крупный самостоятельный UI block.

Примеры:

```text
widgets/
├── interview-editor/
├── interview-sidebar/
├── notification-center/
└── user-profile/
```

Widget может объединять:

- features;
- entities;
- `@packages/ui`;
- shared utilities.

---

# 21. Features Layer

Feature представляет пользовательское действие или законченный сценарий.

Примеры:

```text
features/
├── create-interview/
├── start-interview/
├── send-message/
├── upload-file/
└── update-profile/
```

Feature отвечает на вопрос:

> Что пользователь делает?

UI primitives не являются features.

---

# 22. Entities Layer

Entity представляет бизнес-сущность.

Примеры:

```text
entities/
├── user/
├── interview/
├── question/
├── session/
└── notification/
```

Entity может содержать:

- types;
- API integration;
- queries;
- mutations;
- selectors;
- mappers;
- entity-specific UI.

Пользовательские сценарии должны находиться в `features`.

---

# 23. Shared Layer

`shared` содержит код, не относящийся к конкретному бизнес-домену.

```text
shared/
├── ui/
├── lib/
├── api/
├── config/
├── types/
├── constants/
└── hooks/
```

Общие UI-компоненты должны по возможности находиться в `@packages/ui`.

`shared/ui` используется для application-specific UI, который не имеет смысла выносить в общий package.

---

# 24. Zod

Zod используется для runtime validation.

Основные сценарии:

- forms;
- client-side validation;
- parsing external data;
- configuration validation;
- validation API data при необходимости.

Для форм используется:

```text
React Hook Form
+
Zod
```

Типы рекомендуется выводить из схем:

```ts
const schema = z.object({
  email: z.string().email(),
});

type FormValues = z.infer<typeof schema>;
```

---

# 25. Server State

Для server state используется TanStack Query.

Примеры:

- users;
- interviews;
- questions;
- sessions;
- notifications.

TanStack Query отвечает за:

- fetching;
- caching;
- synchronization;
- refetching;
- mutations;
- invalidation.

Server state не должен без необходимости дублироваться в Zustand.

---

# 26. Client State

Zustand используется для client/application state.

Примеры:

- editor state;
- UI preferences;
- sidebar;
- application workflow;
- временное состояние сложного интерфейса.

Zustand не должен использоваться как замена TanStack Query.

---

# 27. Local State

Если состояние используется только одним компонентом, оно должно оставаться локальным.

```tsx
const [isOpen, setIsOpen] = useState(false);
```

Не следует создавать глобальный Zustand store без необходимости.

---

# 28. Next.js Server / Client Components

По умолчанию используются Server Components.

Client Components используются только при необходимости:

- browser APIs;
- event handlers;
- hooks;
- client-side state;
- interactive UI.

Не следует добавлять:

```tsx
'use client';
```

без необходимости.

Цель — минимизировать Client JavaScript.

---

# 29. Landing

Landing располагается:

```text
apps/landing
```

и реализуется на Astro.

Используется для:

- marketing pages;
- SEO;
- публичного контента;
- статических страниц.

Landing не зависит от `apps/web`.

Допустимо:

```text
apps/landing
    ↓
@packages/ui
```

Запрещено:

```text
apps/landing
    ↓
apps/web
```

---

# 30. Landing и API

Landing не должен обращаться к API без необходимости.

Если необходимы динамические данные, используется `@packages/api` или соответствующая server-side integration.

Landing не должен использовать внутренние механизмы `apps/web`.

---

# 31. TypeScript

TypeScript используется в strict mode.

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

Использование `any` запрещено без обоснованной технической причины.

Предпочтительно:

```ts
unknown
```

с последующим type narrowing.

---

# 32. Styling

Основным инструментом стилизации общего UI является Tailwind CSS в `@packages/ui`.

При создании нового общего UI-компонента:

```text
Reusable across applications?
        │
        ├── YES → @packages/ui
        │
        └── NO → apps/web/shared/ui
```

---

# 33. Performance

Оптимизация выполняется на основании измерений.

Основные направления:

- Server Components;
- code splitting;
- dynamic imports;
- lazy loading;
- image optimization;
- virtualization;
- bundle analysis;
- caching;
- минимизация Client Components.

`memo`, `useMemo` и `useCallback` не должны использоваться автоматически.

---

# 34. Security

Frontend не является источником истины для authorization.

Скрытие UI:

```ts
if (!canEdit) {
  return null;
}
```

не является security mechanism.

Backend обязан самостоятельно проверять permissions.

Frontend должен:

- валидировать пользовательский ввод;
- не хранить secrets;
- не помещать private credentials в client bundle;
- избегать небезопасного HTML;
- корректно работать с authentication.

---

# 35. Testing

Используются:

```text
Unit
Integration
E2E
```

### Unit

Для:

- pure functions;
- utilities;
- transformations;
- isolated logic.

### Integration

Для проверки взаимодействия компонентов и модулей.

### E2E

Для критических пользовательских сценариев.

Например:

```text
Login
Create Interview
Start Interview
Complete Interview
Logout
```

---

# 36. Package Testing

Packages тестируются независимо от applications.

```text
@packages/ui
    ↓
Component / Unit Tests

@packages/api
    ↓
API / Contract Tests
```

Application tests не должны быть единственным способом проверки packages.

---

# 37. Dependencies

Новая dependency добавляется только при наличии конкретной необходимости.

Необходимо проверить:

- существующее решение;
- bundle impact;
- поддержку;
- security;
- совместимость;
- необходимость дополнительной инфраструктуры.

---

# 38. Build Commands

Каждый application и package должен иметь стандартный build command.

```text
packages/ui
    build

packages/api
    generate
    build

apps/web
    build

apps/landing
    build
```

Для UI Kit:

```bash
pnpm --filter @packages/ui build
```

Для API package:

```bash
pnpm --filter @packages/api generate
pnpm --filter @packages/api build
```

Для applications:

```bash
pnpm --filter web build
pnpm --filter landing build
```

Build UI Kit должен использовать:

```text
packages/ui/tsconfig.json
```

а не `apps/web/tsconfig.json`.

---

# 39. Build Order

UI Kit:

```text
packages/ui/tsconfig.json
        ↓
@packages/ui build
        ↓
package output
        ↓
apps/web
apps/landing
```

API:

```text
Backend OpenAPI
       ↓
@packages/api generate
       ↓
@packages/api build
       ↓
apps/web build
```

При использовании Turborepo порядок выполнения должен определяться dependency graph.

Например:

```text
web#build
  ├── ui#build
  └── api#build
```

---

# 40. TypeScript Configuration Boundaries

Каждое приложение и package должно контролировать собственную TypeScript configuration.

```text
apps/web/tsconfig.json
        │
        └── только web

apps/landing/tsconfig.json
        │
        └── только landing

packages/ui/tsconfig.json
        │
        └── только ui

packages/api/tsconfig.json
        │
        └── только api
```

Запрещено строить package таким образом, чтобы его корректность зависела от `tsconfig.json` конкретного приложения.

Это особенно важно для `@packages/ui`, поскольку UI Kit является самостоятельным переиспользуемым package.

# 40. Архитектурные изменения

Архитектурными считаются изменения, затрагивающие:

- FSD;
- Next.js architecture;
- Astro architecture;
- API package;
- OpenAPI generation;
- UI Kit;
- Tailwind architecture;
- state management;
- authentication;
- data fetching;
- package boundaries.

Крупные решения фиксируются через ADR.

---

# 41. Pull Request

Для Frontend PR:

- необходимо **3 обязательных approve**;
- после получения необходимых approve PR может быть merged;
- если PR имеет только **1 approve**, его можно merged не ранее чем через **48 часов** после получения первого approve;
- PR с `Request changes` не должен быть merged;
- после существенных изменений требуется повторное ревью.

К существенным изменениям относятся:

- изменение бизнес-логики;
- изменение API;
- изменение FSD;
- изменение state management;
- изменение UI Kit;
- изменение API package;
- изменение OpenAPI generation;
- изменение архитектуры приложения.

---

# 42. MUST / SHOULD / MUST NOT

## MUST

> Frontend MUST use `@packages/api` for communication with Backend API.

## SHOULD

> Applications SHOULD use `@packages/ui` for common reusable UI components.

## MUST NOT

> `packages/ui` MUST NOT depend on `apps/web`.

---

# 43. Основные архитектурные принципы

1. **`apps/web` — основное продуктовое приложение на Next.js.**
2. **`apps/landing` — отдельное приложение на Astro.**
3. **`@packages/ui` — общий UI Kit на Tailwind CSS.**
4. **`@packages/api` — типизированный API client из Swagger/OpenAPI.**
5. **Generated API code не редактируется вручную.**
6. **Backend OpenAPI является источником истины API contract.**
7. **TanStack Query используется для server state.**
8. **Zustand используется для client/application state.**
9. **Zod используется для runtime validation.**
10. **React Hook Form + Zod используется для forms.**
11. **Общий UI находится в `@packages/ui`.**
12. **Application-specific UI находится в `apps/web/shared/ui`.**
13. **Landing не зависит от `apps/web`.**
14. **Packages не зависят от applications.**
15. **Каждый package и application имеет собственный build process.**
16. **Каждый package имеет собственную TypeScript configuration boundary.**
17. **`@packages/ui` собирается через собственный `packages/ui/tsconfig.json`.**
18. **Архитектурные изменения фиксируются через ADR.**

> **`@packages/api` отвечает за контракт с Backend, `@packages/ui` — за общий визуальный слой, `apps/web` — за продуктовую логику, а `apps/landing` — за публичное представление продукта.**
