import { ArrowDownIcon, CopyIcon, EditIcon, TrashIcon } from "@packages/icons";
import { Button, ButtonGroup } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента ButtonGroup для Storybook.
 */
const meta = {
  title: "Components/ButtonGroup",
  component: ButtonGroup,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **ButtonGroup** — группа связанных кнопок

Контейнер для группировки интерактивных кнопок с общими стилями, единым размером и склеиванием границ (\`attached\`). Поддерживает горизонтальную и вертикальную ориентацию, передачу общих пропсов (\`variant\`, \`size\`, \`disabled\`) всем дочерним кнопкам через контекст.

---

### **Установка и импорт**
\`\`\`tsx
import { Button, ButtonGroup } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<ButtonGroup variant="outline" size="sm">
  <Button>День</Button>
  <Button>Неделя</Button>
  <Button>Месяц</Button>
</ButtonGroup>
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: "select",
      options: ["horizontal", "vertical"],
      description:
        "Ориентация группы кнопок (горизонтальная или вертикальная).",
      table: {
        type: { summary: '"horizontal" | "vertical"' },
        defaultValue: { summary: '"horizontal"' },
      },
    },
    attached: {
      control: "boolean",
      description: "Склеивать ли границы кнопок в единый блок.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
    size: {
      control: "select",
      options: [
        "default",
        "xs",
        "sm",
        "lg",
        "icon",
        "icon-xs",
        "icon-sm",
        "icon-lg",
      ],
      description: "Размер кнопок в группе.",
      table: {
        type: { summary: "string" },
        defaultValue: { summary: '"default"' },
      },
    },
    variant: {
      control: "select",
      options: [
        "default",
        "outline",
        "secondary",
        "success",
        "ghost",
        "destructive",
      ],
      description: "Вариант оформления кнопок в группе.",
      table: {
        type: { summary: "string" },
        defaultValue: { summary: '"default"' },
      },
    },
    disabled: {
      control: "boolean",
      description: "Отключить все кнопки в группе.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
  },
  args: {
    orientation: "horizontal",
    attached: true,
  },
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Стандартная группа кнопок со склеенными границами.
 */
export const Default: Story = {
  render: (args) => (
    <ButtonGroup {...args}>
      <Button variant="outline">Лево</Button>
      <Button variant="outline">Центр</Button>
      <Button variant="outline">Право</Button>
    </ButtonGroup>
  ),
};

/**
 * Группа кнопок действий с иконками.
 */
export const WithIcons: Story = {
  render: () => (
    <ButtonGroup variant="outline" size="sm">
      <Button>
        <EditIcon size="xs" />
        <span>Редактировать</span>
      </Button>
      <Button>
        <CopyIcon size="xs" />
        <span>Копировать</span>
      </Button>
      <Button variant="destructive">
        <TrashIcon size="xs" />
        <span>Удалить</span>
      </Button>
    </ButtonGroup>
  ),
};

/**
 * Раздельные кнопки с отступами (`attached={false}`).
 */
export const Unattached: Story = {
  render: () => (
    <ButtonGroup attached={false} variant="secondary" size="sm">
      <Button>День</Button>
      <Button>Неделя</Button>
      <Button>Месяц</Button>
      <Button>Год</Button>
    </ButtonGroup>
  ),
};

/**
 * Вертикальная ориентация группы кнопок.
 */
export const Vertical: Story = {
  render: () => (
    <ButtonGroup
      orientation="vertical"
      variant="outline"
      size="sm"
      className="w-48"
    >
      <Button>Профиль</Button>
      <Button>Безопасность</Button>
      <Button>Интеграции</Button>
      <Button variant="destructive">Выйти</Button>
    </ButtonGroup>
  ),
};

/**
 * Кнопка с выпадающим меню (Split button).
 */
export const SplitButton: Story = {
  render: () => (
    <ButtonGroup variant="default" size="default">
      <Button>Создать интервью</Button>
      <Button size="icon" aria-label="Дополнительные действия">
        <ArrowDownIcon size="xs" />
      </Button>
    </ButtonGroup>
  ),
};
