# Задачи: Расширение UI Kit и библиотеки иконок (Popover, Alert, RadioGroup, TagInput и иконки)

Данный документ содержит декомпозицию задач по добавлению недостающих базовых компонентов в `@packages/ui` и векторных иконок в `@packages/icons` для поддержки фичей авторизации, витрины, уведомлений и профиля.

---

## 1. Ветка и коммиты

* **Название ветки:** `feat/ui-kit-missing-components`
* **Формат коммита:** `feat(ui): добавить компоненты Popover, Alert, RadioGroup, TagInput и новые иконки`

---

## 2. Структура создаваемых и модифицируемых файлов

```text
packages/
├── icons/src/icons/
│   ├── devops/
│   │   ├── telegram-icon.tsx             # Иконка Telegram
│   │   └── index.ts
│   └── ui/
│       ├── eye-icon.tsx                  # Иконка показа пароля (Eye)
│       ├── eye-off-icon.tsx              # Иконка скрытия пароля (EyeOff)
│       ├── logout-icon.tsx               # Иконка выхода (LogOut)
│       ├── user-icon.tsx                 # Иконка пользователя (User)
│       ├── zap-icon.tsx                  # Иконка молнии/срочности (Zap / Flash)
│       ├── message-square-icon.tsx       # Иконка чата/сообщения (MessageSquare)
│       └── index.ts
│
└── ui/src/components/
    ├── Alert/                            # Баннеры и алерты
    │   ├── alert.tsx
    │   ├── constants.ts
    │   ├── types.ts
    │   └── index.ts
    ├── Popover/                          # Всплывающие панели (Radix UI)
    │   ├── popover.tsx
    │   ├── constants.ts
    │   ├── types.ts
    │   └── index.ts
    ├── RadioGroup/                       # Радио-кнопки (Radix UI)
    │   ├── radio-group.tsx
    │   ├── constants.ts
    │   ├── types.ts
    │   └── index.ts
    ├── TagInput/                         # Ввод тегов / навыков
    │   ├── tag-input.tsx
    │   ├── constants.ts
    │   ├── types.ts
    │   └── index.ts
    └── index.ts                          # Публичные экспорты компонентов
```

---

## 3. Чеклист реализации

### 3.1. Пакет `@packages/icons`
- [ ] **`TelegramIcon`**: векторная иконка Telegram в `icons/devops/` и экспорт.
- [ ] **`EyeIcon` & `EyeOffIcon`**: векторные иконки глаза (показать/скрыть) в `icons/ui/`.
- [ ] **`LogOutIcon`**: векторная иконка выхода из аккаунта в `icons/ui/`.
- [ ] **`UserIcon`**: векторная иконка одиночного профиля пользователя в `icons/ui/`.
- [ ] **`ZapIcon`**: векторная иконка молнии для срочных карточек в `icons/ui/`.
- [ ] **`MessageSquareIcon`**: векторная иконка диалога/сообщения в `icons/ui/`.
- [ ] Экспорт всех новых иконок в `packages/icons/src/index.ts`.

### 3.2. Пакет `@packages/ui`
- [ ] **`Alert`** (`Alert`, `AlertTitle`, `AlertDescription`):
  - Варианты: `default`, `destructive`, `warning`, `info`, `success`.
  - Стилизация через `cva` и Tailwind CSS v4.
- [ ] **`Popover`** (`Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverAnchor`):
  - Headless-примитив `@radix-ui/react-popover`.
  - Стилизация всплывающего окна с анимациями (`fade-in`, `zoom-in-95`).
- [ ] **`RadioGroup`** (`RadioGroup`, `RadioGroupItem`):
  - Headless-примитив `@radix-ui/react-radio-group`.
  - Доступность с клавиатуры, фокусные кольца и кастомный индикатор выбора.
- [ ] **`TagInput`**:
  - Компонент для ввода и удаления массива тегов/навыков (`skills: string[]`).
  - Клавиатурная навигация (`Enter` для добавления, `Backspace` для удаления последнего тега, клик по крестику).
  - Лимит максимального количества тегов и длины тега.
- [ ] Регистрация и экспорт новых компонентов в `packages/ui/src/components/index.ts` и `packages/ui/src/index.ts`.

---

## 4. Критерии приёмки (Definition of Done)

- [ ] Все иконки поддерживают пропсы `size`, `className` и наследуют `currentColor`.
- [ ] Все компоненты строго типизированы без `any`/`as` и имеют русскоязычные JSDoc.
- [ ] Пакеты `@packages/icons` и `@packages/ui` успешно собираются через `rslib build`.
- [ ] Проверка типов `pnpm --filter @packages/icons typecheck` и `pnpm --filter @packages/ui typecheck` проходит без ошибок.
- [ ] Линтер `pnpm lint` не выдает ошибок.
