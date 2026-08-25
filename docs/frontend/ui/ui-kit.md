# UI Kit & shadcn/ui

Пакет `packages/ui` (`@packages/ui`) содержит дизайн-систему и библиотеку переиспользуемых презентационных компонентов монорепозитория.

Официальная документация shadcn/ui: [https://ui.shadcn.com](https://ui.shadcn.com)

---

## 1. Технологический стек UI Kit

* **База:** Headless-примитивы **Radix UI**.
* **Шаблоны компонентов:** **shadcn/ui**.
* **Стилизация:** **Tailwind CSS v4** + `class-variance-authority` (CVA).
* **Сборка:** `tsconfig.build.json` + `tsc-alias` в директорию `dist/`.

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
2. Убедитесь, что стили адаптированы под дизайн-токены проекта.
3. Добавьте публичный экспорт в `packages/ui/src/index.ts`:
   ```ts
   export * from './components/<component-name>';
   ```
4. Соберите пакет:
   ```bash
   pnpm --filter @packages/ui build
   ```

---

## 4. Ограничения UI Kit (Чего НЕ должно быть в `packages/ui`)

Компоненты UI Kit **чисто презентационные**. В них категорически запрещены:
* Прямые API-запросы и `fetch`;
* Зависимости от `apps/web` или `apps/landing`;
* Подключение TanStack Query или Zustand;
* Бизнес-логика авторизации, сессий и доменных сущностей.
