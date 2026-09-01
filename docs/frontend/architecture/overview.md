# Обзор архитектуры Frontend

## 1. Состав монорепозитория

Frontend монорепозитория разделен на приложения (`apps/`) и переиспользуемые пакеты (`packages/`):

```text
monorepo/
├── apps/
│   ├── web/           # Основное продуктовое веб-приложение (Next.js App Router)
│   └── landing/       # Публичный маркетинговый сайт и SEO (Next.js)
│
└── packages/
    ├── ui/            # UI Kit на базе shadcn/ui + Tailwind CSS (@packages/ui)
    ├── api/           # Типизированный API клиент, генерируемый из OpenAPI (@packages/api)
    ├── dto/           # Общие DTO и схемы валидации Zod (@packages/dto)
    └── types/         # Общие TypeScript интерфейсы и типы (@packages/types)
```

---

## 2. Направление зависимостей

Граф зависимостей строго однонаправленный:

```text
apps/web ───────► @packages/ui
   │ ───────────► @packages/api / @packages/dto
   │ ───────────► @packages/types
   │
apps/landing ───► @packages/ui
```

### 🚫 Строгие запреты:
* **`packages/*` НЕ МОГУТ зависеть от `apps/*`** (пакеты не знают о существовании конкретных приложений).
* **`apps/landing` НЕ МОЖЕТ зависеть от `apps/web`**.
* **Циклические зависимости запрещены.**

---

## 3. Границы компиляции и сборки (Boundaries)

Каждый пакет и приложение компилируется **изолированно**:
1. `packages/ui` использует собственный `tsconfig.build.json` и компилируется в `dist/`.
2. `apps/web` потребляет собранный пакет через точку входа `package.json` (`@packages/ui`).
3. Запрещены прямые импорты файлов из исходников пакетов:

```tsx
// ❌ ЗАПРЕЩЕНО (глубокий внутренний импорт)
import { Button } from '@packages/ui/src/components/button/button';

// ✅ РАЗРЕШЕНО (через публичный Public API)
import { Button } from '@packages/ui';
```
