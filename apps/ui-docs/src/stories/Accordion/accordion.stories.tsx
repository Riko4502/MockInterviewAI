import { Accordion } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Accordion для Storybook.
 */
const meta = {
  title: "Components/Accordion",
  component: Accordion,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Accordion** — раскрывающийся аккордеон

Компонент для компактного отображения большого объема информации в виде сворачиваемых секций (FAQ, критерии оценки, этапы собеседования). Построен на базе доступного примитива \`radix-ui\` с плавной анимацией высоты.

---

### **Установка и импорт**
\`\`\`tsx
import { Accordion } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<Accordion type="single" collapsible className="w-full">
  <Accordion.Item value="item-1">
    <Accordion.Trigger>Что оценивает AI-ассистент?</Accordion.Trigger>
    <Accordion.Content>
      AI анализирует глубину понимания архитектуры, чистоту кода и алгоритмическую сложность.
    </Accordion.Content>
  </Accordion.Item>
</Accordion>
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "radio",
      options: ["single", "multiple"],
      description:
        'Режим работы: "single" — открыт максимум один пункт одновременно, "multiple" — можно открыть сразу несколько пунктов.',
      table: { category: "Accordion (Root)" },
    },
    collapsible: {
      control: "boolean",
      description:
        'Только для type="single": разрешает закрыть уже открытый пункт повторным кликом.',
      table: { category: "Accordion (Root)" },
    },
    disabled: {
      control: "boolean",
      description: "Блокирует весь аккордеон целиком.",
      table: { category: "Accordion (Root)" },
    },
  },
  args: {
    type: "single",
    collapsible: true,
  },
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Стандартный аккордеон с единственным открываемым пунктом (Single collapsible).
 */
export const Default: Story = {
  args: {
    type: "single",
    collapsible: true,
  },
  render: () => (
    <div className="w-[500px] max-w-full">
      <Accordion
        type="single"
        collapsible
        defaultValue="faq-1"
        className="w-full"
      >
        <Accordion.Item value="faq-1">
          <Accordion.Trigger>Как проходит AI-интервью?</Accordion.Trigger>
          <Accordion.Content>
            Интервью включает текстовые или голосовые вопросы от AI,
            практическую секцию кодинга в реальном времени и моментальный разбор
            ответов.
          </Accordion.Content>
        </Accordion.Item>

        <Accordion.Item value="faq-2">
          <Accordion.Trigger>
            Какие языки программирования поддерживаются?
          </Accordion.Trigger>
          <Accordion.Content>
            В песочнице поддерживаются TypeScript, JavaScript, Python, Go, Java,
            C++, Rust и C#.
          </Accordion.Content>
        </Accordion.Item>

        <Accordion.Item value="faq-3">
          <Accordion.Trigger>
            Как формируется итоговая оценка кандидата?
          </Accordion.Trigger>
          <Accordion.Content>
            Оценка рассчитывается на основе точности решения тестов,
            асимптотической сложности (Big O), читаемости кода и времени
            решения.
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>
    </div>
  ),
};

/**
 * Режим с возможностью открытия нескольких пунктов одновременно (Multiple).
 */
export const MultipleOpen: Story = {
  args: {
    type: "multiple",
  },
  render: () => (
    <div className="w-[500px] max-w-full">
      <Accordion
        type="multiple"
        defaultValue={["sec-1", "sec-2"]}
        className="w-full"
      >
        <Accordion.Item value="sec-1">
          <Accordion.Trigger>
            Секция 1: Алгоритмические задачи
          </Accordion.Trigger>
          <Accordion.Content>
            3 задачи среднего уровня сложности (LeetCode Medium).
          </Accordion.Content>
        </Accordion.Item>

        <Accordion.Item value="sec-2">
          <Accordion.Trigger>
            Секция 2: Проектирование систем (System Design)
          </Accordion.Trigger>
          <Accordion.Content>
            Архитектурный кейс проектирования распределенного хранилища с
            репликацией.
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>
    </div>
  ),
};
