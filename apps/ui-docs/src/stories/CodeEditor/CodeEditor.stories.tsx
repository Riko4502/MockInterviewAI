import type { LanguageId } from "@packages/editor";
import { CodeEditorLazy, getTemplate } from "@packages/editor";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

/**
 * Метаданные компонента CodeEditor для Storybook.
 */
const meta = {
  title: "Editor",
  component: CodeEditorLazy,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
### **CodeEditor** — редактор кода на базе Monaco Editor

Контролируемый React-компонент, работающий как обёртка над Monaco Editor.
Поддерживает 8 языков программирования, кастомную тёмную тему MockInterviewAI,
отображение курсоров других участников (мультиплеер) и стартовые шаблоны кода.
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    language: {
      control: "select",
      options: [
        "typescript",
        "javascript",
        "python",
        "go",
        "java",
        "cpp",
        "rust",
        "sql",
      ],
      description:
        "Язык программирования для подсветки синтаксиса и автокомплита.",
      table: {
        type: {
          summary:
            '"typescript" | "javascript" | "python" | "go" | "java" | "cpp" | "rust" | "sql"',
        },
        defaultValue: { summary: '"typescript"' },
      },
    },
    readOnly: {
      control: "boolean",
      description: "Запрещает редактирование кода (режим просмотра).",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    value: {
      control: "text",
      description: "Текущее содержимое редактора (контролируемый компонент).",
      table: { type: { summary: "string" } },
    },
  },
  args: {
    language: "typescript",
    readOnly: false,
  },
  decorators: [
    (Story) => (
      <div style={{ height: "500px", padding: "16px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CodeEditorLazy>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Базовый редактор с шаблоном алгоритмической задачи на TypeScript.
 */
export const Default: Story = {
  render: (args) => {
    const [code, setCode] = useState(
      getTemplate((args.language as LanguageId) || "typescript", "algorithm"),
    );
    return <CodeEditorLazy {...args} value={code} onChange={setCode} />;
  },
};

/**
 * Режим только для чтения — код нельзя редактировать.
 * Используется для показа эталонного решения интервьюером.
 */
export const ReadOnly: Story = {
  args: {
    readOnly: true,
  },
  render: (args) => {
    const code = getTemplate("typescript", "algorithm");
    return <CodeEditorLazy {...args} value={code} onChange={() => {}} />;
  },
};

/**
 * Демонстрация переключения между языками.
 * Каждый язык загружает свой стартовый шаблон (бойлерплейт).
 */
export const Languages: Story = {
  render: () => {
    const languages: LanguageId[] = [
      "typescript",
      "javascript",
      "python",
      "go",
      "java",
      "cpp",
      "rust",
    ];
    const [language, setLanguage] = useState<LanguageId>("typescript");
    const [code, setCode] = useState(getTemplate("typescript", "algorithm"));

    const handleLanguageChange = (newLang: LanguageId) => {
      setLanguage(newLang);
      setCode(getTemplate(newLang, "algorithm"));
    };

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {languages.map((lang) => (
            <button
              type="button"
              key={lang}
              onClick={() => handleLanguageChange(lang)}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid",
                borderColor: language === lang ? "#a855f7" : "#333",
                background: language === lang ? "#a855f7" : "transparent",
                color: "white",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              {lang}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <CodeEditorLazy value={code} onChange={setCode} language={language} />
        </div>
      </div>
    );
  },
};
