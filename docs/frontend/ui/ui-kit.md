# UI Kit & shadcn/ui

Пакет `packages/ui` (`@packages/ui`) содержит дизайн-систему и библиотеку переиспользуемых презентационных компонентов монорепозитория.

Официальная документация shadcn/ui: [https://ui.shadcn.com](https://ui.shadcn.com)

---

## 1. Технологический стек UI Kit

* **База:** Headless-примитивы **Radix UI**.
* **Шаблоны компонентов:** **shadcn/ui**.
* **Стилизация:** **Tailwind CSS v4** + `cva` из `@packages/utils`.
* **Сборка:** `rslib build` в директорию `dist/`.

---

## 2. 🌲 Дерево решений: «Мне нужен новый UI-компонент»

```text
Нужен компонент (например, Pagination, DatePicker, Stack)?
│
├── 1. Есть ли компонент в @packages/ui?
│   └── ДА ──► Импортируем: import { Pagination } from '@packages/ui'
│
├── 2. Есть ли подходящий примитив в shadcn/ui?
│   └── ДА ──► Добавляем в packages/ui через CLI или генерацию
│              └── Добавляем экспорт в packages/ui/src/index.ts
│
├── 3. Компонент кастомный (нет в shadcn), но нужен в нескольких местах/приложениях?
│   └── ДА ──► Создаем кастомный компонент в packages/ui/src/components/
│              └── Обязательно пишем Storybook story (*.stories.tsx)
│              └── Экспортируем в packages/ui/src/index.ts
│
└── 4. Компонент специфичен ТОЛЬКО для одной страницы/фичи web?
    └── ДА ──► Создаем в apps/web/src/shared/ui или в слайсе фичи
```

---

## 3. Добавление компонента shadcn в `@packages/ui`

1. Запустите добавление компонента в директории `packages/ui`:
   ```bash
   cd packages/ui
   pnpm dlx shadcn@latest add <component-name>
   ```
2. Убедитесь, что стили адаптированы под дизайн-токены проекта, а `cn`, `cva` импортируются из `@packages/utils`.
3. Добавьте публичный экспорт в `packages/ui/src/index.ts`:
   ```ts
   export * from './components/<component-name>';
   ```
4. Соберите пакет:
   ```bash
   pnpm --filter @packages/ui build
   ```

---

## 4. Глобальные провайдеры (`UIProvider`)

Для работы диалогов, шторок и очереди уведомлений на уровне приложения подключается единый `UIProvider`:

```tsx
// apps/web/src/app/providers/AppProviders.tsx
import { composeProviders, UIProvider } from "@packages/ui";
import { QueryProvider } from "./QueryProvider";
import { SessionProvider } from "@/entities/session";

export const AppProviders = composeProviders(
  QueryProvider,
  SessionProvider,
  UIProvider, // Предоставляет контексты DialogProvider, DrawerProvider и ToastProvider
);
```

### Доступные хуки управления:
* **`useToast()`** — программный вызов уведомлений (`toast.push`, `toast.dismiss`, `toast.allDismiss`) с поддержкой 3D-стопки (аккордеон) и плавного вертикального раскрытия при наведении.
* **`useDrawer<TPayload>()`** — управление шторками по имени (`drawer.open("name", payload)`, `drawer.close("name")`, `drawer.isOpen("name")`, `drawer.get("name")`).
* **`useDialog<TPayload>()`** — управление модальными окнами (`dialog.open("name", payload)`).

---

## 5. Иконки (`@packages/icons`)

* **Строгое правило:** В презентационных компонентах и приложениях **запрещен инлайн-SVG**.
* Все векторные иконки создаются и экспортируются из пакета `@packages/icons`.
* Каждая иконка регистрируется в Storybook в галерее `UI/Icons` с поддержкой копирования кода использования.

---

## 6. 🚀 Ленивая загрузка UI-компонентов (`React.lazy` и `next/dynamic`)

Для оптимизации размера основного JS-бандла (Initial Bundle Size) и ускорения First Contentful Paint (FCP) тяжелые или редко используемые UI-компоненты (модальные окна, шторки, дропзоны файлов, редакторы кода) должны загружаться лениво по требованию.

### Когда применять ленивую загрузку:
* **Модальные окна (`Dialog`) и шторки (`Drawer`):** открываются пользователем по клику и не нужны на этапе первой загрузки страницы.
* **Тяжелые компоненты:** Monaco Code Editor, загрузчики больших файлов, интерактивные чарты и визуализаторы.
* **Никогда НЕ оборачивать в `lazy`:** базовые атомарные элементы (`Button`, `Input`, `Badge`, `Typography`), которые рендерятся сразу.

---

### Паттерн 1: Ленивая загрузка шторки/диалога в Next.js App Router (`next/dynamic`)

Используйте `next/dynamic` с `{ ssr: false }` для компонентов, управляемых через `useDrawer` или `useDialog`:

```tsx
"use client";

import dynamic from "next/dynamic";
import { Button, useDrawer } from "@packages/ui";

// 1. Ленивый импорт тяжелого содержимого шторки
const InterviewFeedbackDrawer = dynamic(
  () =>
    import("@/features/interview-feedback").then(
      (mod) => mod.InterviewFeedbackDrawer,
    ),
  {
    ssr: false,
    loading: () => null, // Либо легковесный Skeleton
  },
);

export function InterviewActionsWidget() {
  const drawer = useDrawer();

  const handleOpenFeedback = () => {
    drawer.open("feedback-drawer", { interviewId: "int_456" });
  };

  return (
    <>
      <Button onClick={handleOpenFeedback}>Посмотреть отзыв</Button>
      {/* Компонент загрузится в браузер только при открытии */}
      <InterviewFeedbackDrawer />
    </>
  );
}
```

---

### Паттерн 2: Ленивая загрузка с `React.lazy` + `Suspense` и Skeleton

Для независимых виджетов и вложенных компонентов в клиентских деревьях:

```tsx
"use client";

import { lazy, Suspense } from "react";
import { Skeleton } from "@packages/ui";

const LazyAttachmentDropzone = lazy(() =>
  import("@/features/file-uploader").then((m) => ({
    default: m.FileAttachmentDropzone,
  })),
);

export function ChatPromptWidget() {
  return (
    <div className="space-y-4">
      <Suspense fallback={<Skeleton className="h-28 w-full rounded-xl" />}>
        <LazyAttachmentDropzone />
      </Suspense>
    </div>
  );
}
```

---

### Паттерн 3: Условный рендеринг по требованию (Mount on Open)

В сочетании с хуками `useDrawer` или `useDialog` ленивый чанк скачивается только в момент, когда шторка действительно активируется пользователем:

```tsx
"use client";

import dynamic from "next/dynamic";
import { useDrawer } from "@packages/ui";

const LazyTopicDrawer = dynamic(() => import("./TopicDrawer"), {
  ssr: false,
});

export function TopicManager() {
  const drawer = useDrawer();
  const isTopicOpen = drawer.isOpen("topic-drawer");

  return (
    <div>
      <button onClick={() => drawer.open("topic-drawer")}>Выбрать тему</button>

      {/* Рендерится и загружает JS чанк только при первом открытии */}
      {isTopicOpen && <LazyTopicDrawer />}
    </div>
  );
}
```

---

## 7. Ограничения UI Kit (Чего НЕ должно быть в `packages/ui`)

1. **Никакой бизнес-логики и запросов к API:** только презентационные свойства (`props`) и локальное UI-состояние (открытие/закрытие, фокус, анимации).
2. **Никаких `any` и `as`:** строгая типизация TypeScript.
3. **Русскоязычные комментарии:** все JSDoc описания компонентов и пропсов оформляются на русском языке.
4. **Все иконки из `@packages/icons`:** запрещен встроенный `<svg>`.

