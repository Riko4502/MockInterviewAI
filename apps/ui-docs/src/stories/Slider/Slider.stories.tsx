import { Volume2Icon } from "@packages/icons";
import { Label, Slider } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

const meta = {
  title: "Components/Slider",
  component: Slider,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Slider** — интерактивный ползунок диапазона значений

Компонент для плавного или пошагового выбора числового значения (например, громкости звука, чувствительности микрофона или яркости). Построен на базе \`radix-ui\` и Tailwind CSS.

---

### **Установка и импорт**
\`\`\`tsx
import { Slider } from "@packages/ui";
\`\`\`

---

### **Базовый пример**
\`\`\`tsx
<Slider defaultValue={[50]} max={100} step={1} />
\`\`\`
        `,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    min: {
      control: "number",
      description: "Минимальное значение шкалы.",
      table: { defaultValue: { summary: "0" } },
    },
    max: {
      control: "number",
      description: "Максимальное значение шкалы.",
      table: { defaultValue: { summary: "100" } },
    },
    step: {
      control: "number",
      description: "Шаг изменения значения.",
      table: { defaultValue: { summary: "1" } },
    },
    disabled: {
      control: "boolean",
      description: "Блокирует взаимодействие со слайдером.",
      table: { defaultValue: { summary: "false" } },
    },
  },
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Стандартный ползунок.
 */
export const Default: Story = {
  render: (args) => (
    <div className="w-80">
      <Slider {...args} defaultValue={[60]} aria-label="Слайдер" />
    </div>
  ),
};

/**
 * Пример управления громкостью с иконкой и текущим значением в процентах.
 */
export const VolumeControl: Story = {
  render: () => {
    const [volume, setVolume] = React.useState([75]);

    return (
      <div className="w-80 space-y-2 rounded-xl border p-4 bg-card">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 font-medium">
            <Volume2Icon className="size-4 text-emerald-500" />
            <Label htmlFor="vol-slider">Громкость звука</Label>
          </div>
          <span className="tabular-nums font-semibold text-muted-foreground">
            {volume[0]}%
          </span>
        </div>
        <Slider
          id="vol-slider"
          value={volume}
          onValueChange={setVolume}
          min={0}
          max={100}
          step={1}
          aria-label="Громкость звука"
        />
      </div>
    );
  },
};

/**
 * Заблокированный ползунок (Disabled).
 */
export const Disabled: Story = {
  render: () => (
    <div className="w-80">
      <Slider
        disabled
        defaultValue={[40]}
        aria-label="Заблокированный слайдер"
      />
    </div>
  ),
};
