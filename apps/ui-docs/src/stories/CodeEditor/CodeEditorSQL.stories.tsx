import { CodeEditorLazy, getTemplate } from "@packages/editor";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

const meta = {
  title: "Editor/SQL",
  component: CodeEditorLazy,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
### **CodeEditor — SQL-режим**

Редактор с поддержкой SQL-синтаксиса и базовым автокомплитом ключевых слов
(SELECT, FROM, WHERE, JOIN и т.д.).

Используется в задачах на написание SQL-запросов к базе данных.
`,
      },
    },
  },
  tags: ["autodocs"],
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
 * SQL-редактор со стартовым шаблоном запроса.
 * Начните вводить ключевые слова (SELECT, WHERE) — появятся подсказки.
 */
export const Default: Story = {
  render: () => {
    const [code, setCode] = useState(getTemplate("sql", "sql"));
    return <CodeEditorLazy value={code} onChange={setCode} language="sql" />;
  },
};

/**
 * SQL в режиме просмотра (ReadOnly).
 * Интервьюер показывает эталонный запрос кандидату.
 */
export const ReadOnlyQuery: Story = {
  render: () => {
    const exampleQuery = `-- Найти топ-5 пользователей по количеству заказов
SELECT
  u.id,
  u.name,
  COUNT(o.id) AS order_count
FROM users u
  LEFT JOIN orders o ON o.user_id = u.id
WHERE u.created_at >= '2024-01-01'
GROUP BY u.id, u.name
ORDER BY order_count DESC
LIMIT 5;`;

    return (
      <CodeEditorLazy
        value={exampleQuery}
        onChange={() => {}}
        language="sql"
        readOnly
      />
    );
  },
};
