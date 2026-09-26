# @packages/editor

Пакет-обёртка вокруг **Monaco Editor** для платформы **MockInterviewAI**.

Предоставляет готовый React-компонент `CodeEditor` с поддержкой 8 языков программирования, кастомных тем оформления, бесконфликтной совместной работы на базе **Yjs CRDT** с отображением курсоров и выделений соавторов (**Yjs Awareness**), а также стартовых шаблонов кода для алгоритмических и SQL-задач.

---

## 📦 Установка и подключение

Пакет является внутренним воркспейсом монорепозитория:

```tsx
// Импорт компонента и типов
import {
  CodeEditor,
  CodeEditorLazy,
  type CodeEditorProps,
  type CodeEditorLazyProps,
  type Theme,
} from "@packages/editor";

// Импорт утилит и конфигов
import {
  getTemplate,
  LANGUAGE_CONFIGS,
  type LanguageId,
  type TaskCategory,
} from "@packages/editor";
```

> **SSR (Next.js):** Monaco Editor работает только в браузере. В `apps/web` используйте `CodeEditorLazy` — обёртку с `React.lazy` + `Suspense`, предотвращающую ошибки серверного рендеринга.

---

## 🧩 Публичный API (экспорты)

### Компоненты

| Экспорт | Тип | Описание |
| :--- | :--- | :--- |
| **`CodeEditor`** | `React.FC` | Основной компонент редактора кода |
| **`CodeEditorLazy`** | `React.FC` | Lazy-обёртка для SSR-совместимости (Next.js) |

### Типы

| Экспорт | Тип | Описание |
| :--- | :--- | :--- |
| **`CodeEditorProps`** | `interface` | Пропсы компонента `CodeEditor` |
| **`CodeEditorLazyProps`** | `interface` | Пропсы для `CodeEditorLazy` |
| **`Theme`** | `type` | Тема оформления: `"dark"` \| `"light"` |
| **`LanguageId`** | `type` | Идентификатор языка программирования |
| **`LanguageConfig`** | `interface` | Конфигурация языка (отступы, название) |
| **`TaskCategory`** | `type` | Категория задачи: `"algorithm"` \| `"sql"` |

### Функции и константы

| Экспорт | Тип | Описание |
| :--- | :--- | :--- |
| **`getTemplate(language, category)`** | `function` | Возвращает стартовый шаблон кода |
| **`updateYjsAwarenessStyles(awareness)`** | `function` | Динамически стилизует курсоры и селекшены соавторов |
| **`removeYjsAwarenessStyles()`** | `function` | Удаляет динамические стили Awareness из `<head>` |
| **`registerThemes(monaco)`** | `function` | Регистрирует кастомные темы в инстансе Monaco |
| **`LANGUAGE_CONFIGS`** | `Record` | Словарь настроек для каждого языка |
| **`THEMES`** | `const` | Массив доступных тем: `["dark", "light"]` |
| **`DEFAULT_EDITOR_OPTIONS`** | `const` | Дефолтные настройки Monaco Editor |

---

## ⚙️ Пропсы `CodeEditorProps`

| Проп | Тип | По умолчанию | Описание |
| :--- | :--- | :--- | :--- |
| `language` | `LanguageId` | `"typescript"` | Язык программирования |
| `theme` | `Theme` | `"dark"` | Тема оформления |
| `readOnly` | `boolean` | `false` | Режим только для чтения |
| `yText` | `Y.Text` | — | Экземпляр Yjs Text для CRDT синхронизации |
| `awareness` | `Awareness` | — | Инстанс Yjs Awareness для отображения курсоров соавторов |
| `undoManager` | `Y.UndoManager` | — | Опциональный внешний менеджер отмен |
| `onUndoManagerInit` | `(um) => void` | — | Коллбэк инициализации локального UndoManager |
| `value` | `string` | `""` | Локальный текст кода (автономный режим без Yjs) |
| `onChange` | `(val) => void` | — | Коллбэк изменения текста (автономный режим) |
| `options` | `editor.IStandalone...` | `{}` | Дополнительные опции Monaco Editor |

---

## 🌐 Поддерживаемые языки

| Язык | `LanguageId` | Tab Size | Отступы | Автокомплит |
| :--- | :--- | :--- | :--- | :--- |
| TypeScript | `typescript` | 2 | Пробелы | Встроенный IntelliSense |
| JavaScript | `javascript` | 2 | Пробелы | Встроенный IntelliSense |
| Python | `python` | 4 | Пробелы | Кастомный (ключевые слова + builtins) |
| Go | `go` | 4 | Табы | Кастомный (ключевые слова + типы) |
| Java | `java` | 4 | Пробелы | Кастомный (ключевые слова + типы) |
| C++ | `cpp` | 4 | Пробелы | Кастомный (ключевые слова + STL) |
| Rust | `rust` | 4 | Пробелы | Кастомный (ключевые слова + макросы) |
| SQL | `sql` | 2 | Пробелы | Кастомный (SQL-команды и агрегаты) |

---

## 🎨 Темы

| Тема | ID | Базовая | Описание |
| :--- | :--- | :--- | :--- |
| Тёмная | `"dark"` | `vs-dark` | Тёмная тема на базе VS Code Dark+ |
| Светлая | `"light"` | `vs` | Светлая тема на базе VS Code Light+ |

---

## 👥 Мультиплеер (Yjs CRDT + Awareness)

Совместная работа основана на **CRDT** (`yjs` + `y-monaco` + `y-protocols/awareness`):

```tsx
import { CodeEditorLazy } from "@packages/editor";
import { useMemo } from "react";
import * as Y from "yjs";

function CollaborativeWorkspace({ yDoc, provider }) {
  const yText = useMemo(() => yDoc.getText("monaco"), [yDoc]);

  return (
    <CodeEditorLazy
      language="typescript"
      theme="dark"
      yText={yText}
      awareness={provider.awareness}
    />
  );
}
```

- **Многопользовательские курсоры:** Позиции и выделения соавторов передаются через Yjs Awareness. Стили каретки, цветного выделения и бейджа с именем участника внедряются автоматически через `updateYjsAwarenessStyles`.
- **Изолированный Undo/Redo:** Компонент настраивает `Y.UndoManager` с фильтрацией `trackedOrigins: new Set([binding])`, так что `Ctrl+Z` отменяет только локальные правки текущего пользователя.

> ⚠️ **RETIRED:** Устаревшие LWW-механизмы (`collaborators: Collaborator[]`, `onCursorChange`, `code.update`, `cursor.move`) выведены из эксплуатации.

---

## 📝 Шаблоны кода

```ts
import { getTemplate } from "@packages/editor";

// Алгоритмическая задача на Python
const template = getTemplate("python", "algorithm");

// SQL-задача
const sqlTemplate = getTemplate("sql", "sql");
```

---

## 📖 Storybook

Интерактивные истории компонента, включая совместное редактирование в реальном времени, доступны в Storybook:

```bash
pnpm storybook
```

История `Editor/Multiplayer` демонстрирует работу двух редакторов с единым документом `Y.Doc` и трансляцией курсоров через `Awareness`.
