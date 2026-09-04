import { Progress } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

const meta = {
  title: "UI/Progress",
  component: Progress,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
Прогресс-бар на основе Radix Progress. Проп \`value\` — текущее значение,
\`max\` — максимум шкалы (по умолчанию 100). Процент заливки считается как \`(value / max) * 100\`.

Если \`value\` не передан (\`undefined\`) — компонент переходит в состояние \`indeterminate\`
("идёт процесс, но неизвестно сколько именно осталось").
        `,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    value: {
      control: { type: "number", min: 0 },
      description:
        "Текущее значение прогресса. Если не задано — состояние indeterminate.",
    },
    max: {
      control: { type: "number", min: 1 },
      description: "Максимальное значение шкалы. По умолчанию 100.",
    },
  },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { value: 40, "aria-label": "Прогресс" },
  render: (args) => <Progress {...args} className="w-64" />,
};

/**
 * Прогресс-бар в завершённом состоянии (100%).
 */

export const Complete: Story = {
  args: { value: 100, "aria-label": "Прогресс" },
  render: (args) => <Progress {...args} className="w-64" />,
};

/**
 * Неопределённое состояние — когда прогресс ещё не известен
 * (например, до получения первых данных о ходе загрузки).
 */

export const Indeterminate: Story = {
  args: { value: undefined, "aria-label": "Прогресс" },
  render: (args) => <Progress {...args} className="w-64" />,
};

/**
 * Пример с нестандартной шкалой (max=300) — показывает, что проценты
 * считаются относительно max, а не всегда из 100.
 */

export const CustomMax: Story = {
  args: { value: 150, max: 300, "aria-label": "Прогресс" },
  render: (args) => <Progress {...args} className="w-64" />,
};

/**
 * Анимированный пример — значение увеличивается автоматически,
 * имитируя реальный процесс загрузки.
 */

export const Animated: Story = {
  render: () => {
    const [value, setValue] = React.useState(13);

    React.useEffect(() => {
      const timer = setTimeout(() => setValue(78), 600);
      return () => clearTimeout(timer);
    }, []);

    return <Progress value={value} aria-label="Прогресс" className="w-64" />;
  },
};

/**
 * Составной вариант с подписью и процентами.
 */

export const WithLabel: Story = {
  render: () => (
    <div className="w-80">
      <Progress value={23} className="w-full max-w-sm">
        <Progress.Label>Upload progress</Progress.Label>
        <Progress.Value />
      </Progress>
    </div>
  ),
};

/**
 * Управляемый прогресс — значение меняется слайдером.
 */
export const Controlled: Story = {
  render: () => {
    const [value, setValue] = React.useState(50);
    return (
      <div className="w-80 space-y-3">
        <Progress value={value}>
          <Progress.Label>Progress</Progress.Label>
          <Progress.Value />
        </Progress>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-full"
        />
      </div>
    );
  },
};
