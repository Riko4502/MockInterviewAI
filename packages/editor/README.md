# @packages/editor

Пакет-обёртка вокруг **Monaco Editor** для платформы **MockInterviewAI**.

Предоставляет готовый React-компонент `CodeEditor` с поддержкой множества языков программирования, кастомных тем оформления, мультиплеерных курсоров (коллаборация в реальном времени) и стартовых шаблонов кода для алгоритмических и SQL-задач.

---

## 📦 Установка и подключение

Пакет является внутренним воркспейсом монорепозитория:

```tsx
// Импорт компонента и типов
import {
  CodeEditor,
  CodeEditorLazy,
  type CodeEditorProps,
  type CursorPosition,
  type Collaborator,
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

> **SSR (Next.js):** Monaco Editor работает только в браузере. В `apps/web` используйте `CodeEditorLazy` — обёртку с `React.lazy` + `Suspense`, которая предотвращает ошибки серверного рендеринга.

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
| **`CursorPosition`** | `interface` | Позиция курсора (`line`, `column`, `selectionEnd*`) |
| **`Collaborator`** | `interface` | Участник комнаты (`id`, `name`, `color`, `cursor?`) |
| **`Theme`** | `type` | Тема оформления: `"dark"` \| `"light"` |
| **`LanguageId`** | `type` | Идентификатор языка программирования |
| **`LanguageConfig`** | `interface` | Конфигурация языка (отступы, название) |
| **`TaskCategory`** | `type` | Категория задачи: `"algorithm"` \| `"sql"` |
| **`CodeEditorLazyProps`** | `interface` | Пропсы для `CodeEditorLazy` (наследует `CodeEditorProps`) |

### Функции и константы

| Экспорт | Тип | Описание |
| :--- | :--- | :--- |
| **`getTemplate(language, category)`** | `function` | Возвращает стартовый шаблон кода для языка и категории задачи |
| **`registerThemes(monaco)`** | `function` | Регистрирует кастомные темы в инстансе Monaco |
| **`LANGUAGE_CONFIGS`** | `Record` | Словарь настроек отступов для каждого языка |
| **`THEMES`** | `const` | Массив доступных тем: `["dark", "light"]` |
| **`DEFAULT_EDITOR_OPTIONS`** | `const` | Дефолтные настройки Monaco Editor |

---

## ⚙️ Пропсы `CodeEditorProps`

| Проп | Тип | По умолчанию | Описание |
| :--- | :--- | :--- | :--- |
| `value` | `string` | `""` | Текст кода в редакторе (управляемое состояние) |
| `onChange` | `(value: string) => void` | — | Коллбэк при изменении текста |
| `language` | `LanguageId` | `"typescript"` | Язык программирования |
| `theme` | `Theme` | `"dark"` | Тема оформления |
| `readOnly` | `boolean` | `false` | Режим только для чтения |
| `collaborators` | `Collaborator[]` | `[]` | Массив участников для отображения их курсоров |
| `onCursorChange` | `(position: CursorPosition) => void` | — | Коллбэк при перемещении курсора (с троттлингом) |
| `cursorThrottleMs` | `number` | `50` | Интервал троттлинга курсора в мс |
| `options` | `editor.IStandaloneEditorConstructionOptions` | `{}` | Дополнительные опции Monaco Editor |

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

> **TypeScript и JavaScript** получают полноценный IntelliSense из коробки Monaco Editor. Для остальных языков регистрируется базовый автокомплит ключевых слов.

---

## 🎨 Темы

Пакет регистрирует две кастомные темы, наследующие стандартные цветовые схемы VS Code:

| Тема | ID | Базовая | Описание |
| :--- | :--- | :--- | :--- |
| Тёмная | `"dark"` | `vs-dark` | Тёмная тема на базе VS Code Dark+ |
| Светлая | `"light"` | `vs` | Светлая тема на базе VS Code Light+ |

Темы регистрируются автоматически при инициализации редактора (в `beforeMount`).

---

## 👥 Мультиплеер (курсоры соавторов)

Компонент поддерживает отображение курсоров других участников в реальном времени. Дизайн курсоров: цветные «флажки» с именем участника (как в Google Docs / VS Code Live Share).

### Использование

```tsx
import { CodeEditor, type Collaborator, type CursorPosition } from "@packages/editor";

const collaborators: Collaborator[] = [
  {
    id: "user-2",
    name: "Интервьюер",
    color: "#FF6B6B",
    cursor: { line: 5, column: 12 },
  },
];

function handleCursorChange(position: CursorPosition) {
  // Отправить позицию через WebSocket (событие cursor.move)
  ws.send(JSON.stringify({ type: "cursor.move", payload: position }));
}

<CodeEditor
  value={code}
  onChange={setCode}
  language="typescript"
  collaborators={collaborators}
  onCursorChange={handleCursorChange}
  cursorThrottleMs={50}
/>;
```

### Интеграция с Realtime

Поля типа `CursorPosition` (`line`, `column`, `selectionEndLine`, `selectionEndColumn`) совпадают с контрактом `CursorPayload` протокола WebSocket (`cursor.move`), что позволяет напрямую маппить данные без трансформаций.

---

## 📝 Шаблоны кода

Функция `getTemplate` возвращает стартовый шаблон (бойлерплейт) для выбранного языка и категории задачи:

```ts
import { getTemplate } from "@packages/editor";

// Алгоритмическая задача на Python
const template = getTemplate("python", "algorithm");
// → "def solution(nums: list[int]) -> int:\n    # Ваш код здесь\n    pass\n"

// SQL-задача
const sqlTemplate = getTemplate("sql", "sql");
// → "-- Напишите ваш SQL-запрос ниже\nSELECT * FROM users;\n"
```

---

## 🛠️ Архитектурные правила и стандарты

1. **Только через Public API:** запрещены глубокие импорты из внутренностей пакета.
   ```tsx
   // ❌ ЗАПРЕЩЕНО
   import { CodeEditor } from "@packages/editor/src/components/CodeEditor/code-editor";

   // ✅ РАЗРЕШЕНО
   import { CodeEditor } from "@packages/editor";
   ```
2. **Строгая типизация:** полный запрет на `any` и `as`.
3. **Русскоязычные комментарии:** все JSDoc описания оформляются на русском языке.
4. **Нет бизнес-логики:** пакет — чистая UI-обёртка. Логика подключения к WebSocket, управление состоянием комнаты и хранение кода — ответственность `apps/web`.

---

## 📖 Storybook

Истории компонента расположены в `apps/ui-docs/src/stories/CodeEditor/`:

```bash
pnpm storybook
```

Storybook доступен по адресу `http://localhost:6006`.

---

## 🔨 Сборка и проверка

```bash
# Сборка пакета (Rslib)
pnpm --filter @packages/editor build

# Проверка типов TypeScript
pnpm --filter @packages/editor typecheck

# Линтинг (Biome)
pnpm --filter @packages/editor lint

# Автоформатирование
pnpm --filter @packages/editor format

# Тесты (Vitest)
pnpm --filter @packages/editor test
```

---

## 📁 Структура пакета

```
packages/editor/
├── package.json
├── rslib.config.ts
├── tsconfig.json
├── vitest.config.ts
├── README.md
└── src/
    ├── index.ts                        # Точка входа: реэкспорт всех модулей
    ├── components/
    │   ├── index.ts
    │   └── CodeEditor/
    │       ├── index.ts                # Public API компонента
    │       ├── types.ts                # CodeEditorProps, CursorPosition, Collaborator
    │       ├── constants.ts            # DEFAULT_EDITOR_OPTIONS
    │       ├── code-editor.tsx         # Основной компонент
    │       └── code-editor.lazy.tsx    # Lazy-обёртка для SSR
    ├── themes/
    │   ├── index.ts
    │   ├── register.ts                 # registerThemes() + THEMES
    │   ├── mockinterview-dark.ts       # Тёмная тема (vs-dark)
    │   └── mockinterview-light.ts      # Светлая тема (vs)
    ├── languages/
    │   ├── index.ts
    │   ├── config.ts                   # LanguageId, LANGUAGE_CONFIGS
    │   ├── python.ts                   # registerPythonCompletion
    │   ├── go.ts                       # registerGoCompletion
    │   ├── java.ts                     # registerJavaCompletion
    │   ├── cpp.ts                      # registerCppCompletion
    │   ├── rust.ts                     # registerRustCompletion
    │   └── sql.ts                      # registerSqlCompletion
    ├── templates/
    │   ├── index.ts
    │   ├── get-template.ts             # getTemplate(language, category)
    │   ├── get-template.test.ts        # Vitest тесты (10 кейсов)
    │   ├── algorithm.ts                # Шаблоны для алгоритмических задач
    │   └── sql.ts                      # Шаблоны для SQL-задач
    └── multiplayer/
        ├── index.ts
        ├── use-remote-cursors.ts       # Хук useRemoteCursors
        └── cursor-css.ts              # Генерация CSS для чужих курсоров
```

---

## 🔗 Зависимости

| Зависимость | Тип | Назначение |
| :--- | :--- | :--- |
| `@monaco-editor/react` | dependency | React-обёртка для Monaco Editor |
| `monaco-editor` | dependency | Ядро редактора кода (типы + runtime) |
| `@packages/types` | workspace | Общий тип `Theme` |
| `@packages/ui` | workspace | Дизайн-система (CSS-переменные) |
| `react`, `react-dom` | peer | Хост-приложение предоставляет React |
