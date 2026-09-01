import { Select } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

const meta = {
  title: "UI/Select",
  component: Select,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "primary", "secondary"],
      description:
        "Визуальный стиль всего Select-дерева (передаётся через контекст). " +
        "`default` — прозрачный фон с рамкой; " +
        "`primary` — фон основного цвета; " +
        "`secondary` — фон вторичного цвета.",
      table: {
        type: { summary: '"default" | "primary" | "secondary"' },
        defaultValue: { summary: '"default"' },
      },
    },
    value: {
      control: "text",
      description:
        "Управляемое значение выбранного элемента. Требует `onValueChange`.",
      table: { type: { summary: "string" } },
    },
    defaultValue: {
      control: "text",
      description: "Неуправляемое начальное значение.",
      table: { type: { summary: "string" } },
    },
    disabled: {
      control: "boolean",
      description: "Блокирует весь компонент.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    open: {
      control: "boolean",
      description:
        "Управляемое состояние открытого/закрытого выпадающего списка.",
      table: { type: { summary: "boolean" } },
    },
    onValueChange: {
      action: "valueChange",
      description: "Обработчик смены выбранного значения.",
      table: { type: { summary: "(value: string) => void" } },
    },
    children: {
      control: false,
      description:
        "Содержимое. Используйте sub-компоненты: " +
        "`Select.Trigger` — кнопка-триггер; " +
        "`Select.Value` — отображение выбранного значения; " +
        "`Select.Content` — выпадающий список; " +
        "`Select.Item` — пункт списка; " +
        "`Select.Group` — группа пунктов; " +
        "`Select.Label` — заголовок группы; " +
        "`Select.Separator` — разделитель.",
      table: { type: { summary: "ReactNode" } },
    },
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

const TECHS = [
  { value: "react", label: "React" },
  { value: "vue", label: "Vue" },
  { value: "angular", label: "Angular" },
  { value: "svelte", label: "Svelte" },
  { value: "solid", label: "SolidJS" },
];

// ─── Select (root) stories ───

export const Default: Story = {
  name: "Select / Default",
  render: () => (
    <Select defaultValue="react">
      <Select.Trigger className="w-52">
        <Select.Value placeholder="Выберите технологию" />
      </Select.Trigger>
      <Select.Content>
        {TECHS.map((t) => (
          <Select.Item key={t.value} value={t.value}>
            {t.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select>
  ),
};

export const Primary: Story = {
  name: "Select / Primary Variant",
  render: () => (
    <Select variant="primary" defaultValue="react">
      <Select.Trigger className="w-52">
        <Select.Value placeholder="Выберите технологию" />
      </Select.Trigger>
      <Select.Content>
        {TECHS.map((t) => (
          <Select.Item key={t.value} value={t.value}>
            {t.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select>
  ),
};

export const Secondary: Story = {
  name: "Select / Secondary Variant",
  render: () => (
    <Select variant="secondary" defaultValue="vue">
      <Select.Trigger className="w-52">
        <Select.Value placeholder="Выберите технологию" />
      </Select.Trigger>
      <Select.Content>
        {TECHS.map((t) => (
          <Select.Item key={t.value} value={t.value}>
            {t.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select>
  ),
};

export const Disabled: Story = {
  name: "Select / Disabled",
  render: () => (
    <Select disabled defaultValue="react">
      <Select.Trigger className="w-52">
        <Select.Value />
      </Select.Trigger>
      <Select.Content>
        {TECHS.map((t) => (
          <Select.Item key={t.value} value={t.value}>
            {t.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select>
  ),
};

export const WithPlaceholder: Story = {
  name: "Select / With Placeholder",
  render: () => (
    <Select>
      <Select.Trigger className="w-52">
        <Select.Value placeholder="Выберите технологию..." />
      </Select.Trigger>
      <Select.Content>
        {TECHS.map((t) => (
          <Select.Item key={t.value} value={t.value}>
            {t.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select>
  ),
};

export const WithGroups: Story = {
  name: "Select / With Groups & Separator",
  parameters: {
    docs: {
      description: {
        story:
          "Пример использования `Select.Group`, `Select.Label` и `Select.Separator` " +
          "для структурирования большого списка по категориям.",
      },
    },
  },
  render: () => (
    <Select>
      <Select.Trigger className="w-64">
        <Select.Value placeholder="Выберите технологию" />
      </Select.Trigger>
      <Select.Content>
        <Select.Group>
          <Select.Label>Frontend</Select.Label>
          <Select.Item value="react">React</Select.Item>
          <Select.Item value="vue">Vue</Select.Item>
          <Select.Item value="angular">Angular</Select.Item>
        </Select.Group>
        <Select.Separator />
        <Select.Group>
          <Select.Label>Backend</Select.Label>
          <Select.Item value="nodejs">Node.js</Select.Item>
          <Select.Item value="python">Python</Select.Item>
          <Select.Item value="go">Go</Select.Item>
        </Select.Group>
        <Select.Separator />
        <Select.Group>
          <Select.Label>DevOps</Select.Label>
          <Select.Item value="docker">Docker</Select.Item>
          <Select.Item value="k8s">Kubernetes</Select.Item>
        </Select.Group>
      </Select.Content>
    </Select>
  ),
};

export const Controlled: Story = {
  name: "Select / Controlled",
  parameters: {
    docs: {
      description: {
        story:
          "Управляемый `Select` с `value` + `onValueChange`. " +
          "Текущее значение отображается под компонентом.",
      },
    },
  },
  render: () => {
    const [value, setValue] = useState("react");
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "center",
        }}
      >
        <Select value={value} onValueChange={setValue}>
          <Select.Trigger className="w-52">
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {TECHS.map((t) => (
              <Select.Item key={t.value} value={t.value}>
                {t.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          Выбрано: <strong>{value}</strong>
        </p>
      </div>
    );
  },
};

// ─────────────────────────────────────────────
// Select.Trigger — отдельная история
// ─────────────────────────────────────────────

export const SelectTriggerStory: Story = {
  name: "Select.Trigger",
  parameters: {
    docs: {
      description: {
        story:
          "`Select.Trigger` — кнопка-триггер, открывающая выпадающий список. " +
          "Содержит `Select.Value` и автоматически добавляет иконку шеврона.\n\n" +
          "**Пропсы:**\n" +
          '- `variant` — `"default" | "primary" | "secondary"` (переопределяет контекст)\n' +
          '- `size` — `"default"` (32px) | `"sm"` (28px)\n' +
          "- `className` — дополнительные CSS-классы\n" +
          "- `disabled` — блокирует кнопку",
      },
    },
  },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Select>
        <Select.Trigger className="w-52" size="default">
          <Select.Value placeholder="size=default (32px)" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="a">Вариант A</Select.Item>
        </Select.Content>
      </Select>
      <Select>
        <Select.Trigger className="w-52" size="sm">
          <Select.Value placeholder="size=sm (28px)" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="a">Вариант A</Select.Item>
        </Select.Content>
      </Select>
      <Select>
        <Select.Trigger className="w-52" variant="primary">
          <Select.Value placeholder="variant=primary" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="a">Вариант A</Select.Item>
        </Select.Content>
      </Select>
    </div>
  ),
};

// ─────────────────────────────────────────────
// Select.Item — отдельная история
// ─────────────────────────────────────────────

export const SelectItemStory: Story = {
  name: "Select.Item",
  parameters: {
    docs: {
      description: {
        story:
          "`Select.Item` — пункт выпадающего списка. " +
          "Показывает галочку при выборе. Поддерживает состояние `disabled`.\n\n" +
          "**Пропсы:**\n" +
          "- `value` *(обязательный)* — уникальный строковый идентификатор пункта\n" +
          "- `disabled` — блокирует пункт\n" +
          "- `variant` — переопределяет стиль из контекста Select\n" +
          "- `children` — отображаемый текст или JSX",
      },
    },
  },
  render: () => (
    <Select defaultValue="react">
      <Select.Trigger className="w-52">
        <Select.Value />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="react">React (обычный)</Select.Item>
        <Select.Item value="vue">Vue (обычный)</Select.Item>
        <Select.Item value="angular" disabled>
          Angular (disabled)
        </Select.Item>
        <Select.Item value="svelte">Svelte (обычный)</Select.Item>
      </Select.Content>
    </Select>
  ),
};

// ─────────────────────────────────────────────
// Select.Group + Select.Label + Select.Separator
// ─────────────────────────────────────────────

export const SelectGroupLabelSeparator: Story = {
  name: "Select.Group / Label / Separator",
  parameters: {
    docs: {
      description: {
        story:
          "**Select.Group** — контейнер для логической группы пунктов (`padding: 4px`).\n\n" +
          "**Select.Label** — заголовок группы (`text-xs`, `opacity-70`). Не кликабелен.\n\n" +
          "**Select.Separator** — горизонтальный разделитель между группами (`h-px bg-border/50`).",
      },
    },
  },
  render: () => (
    <Select>
      <Select.Trigger className="w-56">
        <Select.Value placeholder="Выберите категорию" />
      </Select.Trigger>
      <Select.Content>
        <Select.Group>
          <Select.Label>Языки</Select.Label>
          <Select.Item value="ts">TypeScript</Select.Item>
          <Select.Item value="py">Python</Select.Item>
        </Select.Group>
        <Select.Separator />
        <Select.Group>
          <Select.Label>Фреймворки</Select.Label>
          <Select.Item value="react">React</Select.Item>
          <Select.Item value="next">Next.js</Select.Item>
        </Select.Group>
      </Select.Content>
    </Select>
  ),
};
