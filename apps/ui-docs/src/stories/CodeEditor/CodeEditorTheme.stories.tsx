import { CodeEditorLazy } from "@packages/editor";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

const meta = {
  title: "Editor/Theme",
  component: CodeEditorLazy,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
### **CodeEditor — Тема оформления**

Редактор использует кастомную тёмную тему mockinterview-dark,
построенную на цветовой палитре проекта из @packages/tailwind-config.

Цвета фона, текста, курсора, выделения, номеров строк и скроллбара
точно соответствуют дизайн-системе MockInterviewAI.

Тема применяется автоматически и не требует настройки.
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
 * Демонстрация цветовой схемы на примере реального TypeScript-кода.
 * Обратите внимание на цвета ключевых слов, строк, типов и комментариев.
 */
export const DarkTheme: Story = {
  render: () => {
    const code = `/**
 * Бинарный поиск элемента в отсортированном массиве.
 * @param nums - Отсортированный массив чисел
 * @param target - Искомое значение
 * @returns Индекс элемента или -1, если не найден
 */
function binarySearch(nums: number[], target: number): number {
  let left = 0;
  let right = nums.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const value = nums[mid];

    if (value === target) {
      return mid;
    } else if (value < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return -1;
}

// Пример использования
const sorted = [1, 3, 5, 7, 9, 11, 13, 15];
const index = binarySearch(sorted, 7);
console.log(\`Элемент найден на позиции: \${index}\`);
`;
    const [value, setValue] = useState(code);
    return (
      <CodeEditorLazy value={value} onChange={setValue} language="typescript" />
    );
  },
};

/**
 * Светлая тема (mockinterview-light).
 * Базируется на стандартной теме `vs` от Monaco Editor.
 * Переключение темы происходит через проп `theme`.
 */
export const LightTheme: Story = {
  render: () => {
    const code = `/**
 * Бинарный поиск элемента в отсортированном массиве.
 * @param nums - Отсортированный массив чисел
 * @param target - Искомое значение
 * @returns Индекс элемента или -1, если не найден
 */
function binarySearch(nums: number[], target: number): number {
  let left = 0;
  let right = nums.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const value = nums[mid];

    if (value === target) {
      return mid;
    } else if (value < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return -1;
}

// Пример использования
const sorted = [1, 3, 5, 7, 9, 11, 13, 15];
const index = binarySearch(sorted, 7);
console.log(\`Элемент найден на позиции: \${index}\`);
`;
    const [value, setValue] = useState(code);
    return (
      <div
        style={{ background: "#ffffff", height: "100%", borderRadius: "8px" }}
      >
        <CodeEditorLazy
          value={value}
          onChange={setValue}
          language="typescript"
          theme="light"
        />
      </div>
    );
  },
};

/**
 * Сравнение тёмной и светлой тем рядом (Split View).
 */
export const DarkVsLight: Story = {
  render: () => {
    const code = `function hello(name: string): string {\n  return \`Hello, \${name}!\`;\n}\n\nconst result = hello("World");\nconsole.log(result);\n`;
    const [darkCode, setDarkCode] = useState(code);
    const [lightCode, setLightCode] = useState(code);
    return (
      <div style={{ display: "flex", gap: "16px", height: "100%" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <span style={{ color: "#a1a1aa", fontSize: "13px" }}>
            🌙 mockinterview-dark
          </span>
          <div style={{ flex: 1 }}>
            <CodeEditorLazy
              value={darkCode}
              onChange={setDarkCode}
              language="typescript"
            />
          </div>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <span style={{ color: "#a1a1aa", fontSize: "13px" }}>
            ☀️ mockinterview-light
          </span>
          <div style={{ flex: 1, background: "#ffffff", borderRadius: "8px" }}>
            <CodeEditorLazy
              value={lightCode}
              onChange={setLightCode}
              language="typescript"
              theme="light"
            />
          </div>
        </div>
      </div>
    );
  },
};

/**
 * Тема с отключёнными подсказками (хардкор-режим собеседования).
 * Используется, когда интервьюер хочет проверить знания кандидата без автокомплита.
 */
export const NoAutocomplete: Story = {
  render: () => {
    const [code, setCode] = useState(
      `# Хардкор-режим: автокомплит отключён\n# Напишите решение самостоятельно\n\ndef two_sum(nums: list[int], target: int) -> list[int]:\n    seen = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in seen:\n            return [seen[complement], i]\n        seen[num] = i\n    return []\n`,
    );
    return (
      <CodeEditorLazy
        value={code}
        onChange={setCode}
        language="python"
        options={{
          quickSuggestions: false,
          suggestOnTriggerCharacters: false,
          parameterHints: { enabled: false },
        }}
      />
    );
  },
};
