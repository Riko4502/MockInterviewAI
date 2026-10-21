import { Combobox } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

/**
 * Метаданные компонента Combobox для Storybook.
 */
const meta = {
  title: "Components/Combobox",
  component: Combobox,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Combobox** — селектор с поиском

Компонент выбора одного значения из списка с текстовым поиском и группировкой опций.
Построен на базе доступного примитива \`radix-ui\` (Popover). Поддерживает навигацию клавиатурой (↑/↓/Enter), фильтрацию по \`label\`/\`value\`/\`keywords\` и кастомный предикат поиска.

---

### **Установка и импорт**
\`\`\`tsx
import { Combobox } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<Combobox
  value={value}
  onValueChange={setValue}
  options={[
    { value: "react", label: "React" },
    { value: "vue", label: "Vue" },
  ]}
  placeholder="Выберите технологию"
  searchPlaceholder="Поиск..."
  emptyText="Ничего не найдено"
/>
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    value: {
      control: "text",
      description: "Текущее выбранное значение.",
      table: { type: { summary: "string" } },
    },
    onValueChange: {
      action: "valueChange",
      description: "Обработчик смены выбранного значения.",
      table: { type: { summary: "(value: string) => void" } },
    },
    placeholder: {
      control: "text",
      description: "Текст триггера при отсутствии выбора.",
      table: { type: { summary: "string" } },
    },
    searchPlaceholder: {
      control: "text",
      description: "Плейсхолдер поля поиска.",
      table: { type: { summary: "string" } },
    },
    emptyText: {
      control: "text",
      description: "Текст при пустом результате фильтрации.",
      table: { type: { summary: "string" } },
    },
    disabled: {
      control: "boolean",
      description: "Блокирует компонент.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
  },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

const TIMEZONES = [
  {
    key: "europe",
    label: "Europe",
    options: [
      { value: "Europe/Moscow", label: "Moscow" },
      { value: "Europe/London", label: "London" },
      { value: "Europe/Berlin", label: "Berlin" },
    ],
  },
  {
    key: "asia",
    label: "Asia",
    options: [
      { value: "Asia/Tokyo", label: "Tokyo" },
      { value: "Asia/Singapore", label: "Singapore" },
    ],
  },
];

/**
 * Плоский список опций без группировки.
 */
export const Default: Story = {
  render: () => {
    const [value, setValue] = useState<string | undefined>("react");
    return (
      <div className="w-72">
        <Combobox
          value={value}
          onValueChange={setValue}
          options={[
            { value: "react", label: "React / Next.js" },
            { value: "vue", label: "Vue / Nuxt" },
            { value: "angular", label: "Angular" },
            { value: "svelte", label: "SvelteKit" },
          ]}
          placeholder="Выберите технологию"
          searchPlaceholder="Поиск технологии..."
          emptyText="Ничего не найдено"
        />
      </div>
    );
  },
};

/**
 * Группировка опций с заголовками и поиском по `keywords`.
 */
export const WithGroups: Story = {
  render: () => {
    const [value, setValue] = useState<string | undefined>("Europe/Moscow");
    return (
      <div className="w-72">
        <Combobox
          value={value}
          onValueChange={setValue}
          groups={TIMEZONES}
          placeholder="Выберите таймзону"
          searchPlaceholder="Поиск таймзоны..."
          emptyText="Ничего не найдено"
        />
      </div>
    );
  },
};

/**
 * Заблокированный селект (Disabled).
 */
export const Disabled: Story = {
  render: () => (
    <div className="w-72">
      <Combobox
        disabled
        value="Europe/Moscow"
        groups={TIMEZONES}
        placeholder="Выберите таймзону"
        searchPlaceholder="Поиск таймзоны..."
      />
    </div>
  ),
};
