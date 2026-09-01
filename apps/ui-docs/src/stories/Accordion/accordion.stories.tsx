import { Accordion } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "UI/Accordion",
  component: Accordion,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
Составной компонент: **Accordion** (корень) + **Accordion.Item** + **Accordion.Trigger** + **Accordion.Content**.

**Как собирать:**
\`\`\`tsx
<Accordion type="single" collapsible>
  <Accordion.Item value="item-1">
    <Accordion.Trigger>Заголовок</Accordion.Trigger>
    <Accordion.Content>Содержимое</Accordion.Content>
  </Accordion.Item>
</Accordion>
\`\`\`

Каждый \`Accordion.Item\` обязательно должен иметь уникальный проп \`value\` — по нему компонент
понимает, какой именно пункт сейчас открыт.
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
        'Только для type="single": разрешает закрыть уже открытый пункт повторным кликом. По умолчанию false — тогда всегда должен оставаться открытым ровно один пункт.',
      table: { category: "Accordion (Root)" },
    },
    disabled: {
      control: "boolean",
      description:
        "Блокирует весь аккордеон целиком — все пункты сразу перестают реагировать на клики.",
      table: { category: "Accordion (Root)" },
    },
    defaultValue: {
      control: false,
      description:
        'Значение(-я) открытого(-ых) пункта(-ов) по умолчанию, неконтролируемый режим. Строка для type="single", массив строк для type="multiple".',
      table: { category: "Accordion (Root)" },
    },
    value: {
      control: false,
      description:
        "Контролируемое значение открытого(-ых) пункта(-ов) — используется вместе с onValueChange.",
      table: { category: "Accordion (Root)" },
    },
    onValueChange: {
      control: false,
      description:
        "Коллбэк, вызывается при изменении открытого(-ых) пункта(-ов) (контролируемый режим).",
      table: { category: "Accordion (Root)" },
    },
  },
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { type: "single" },
  render: () => (
    <Accordion type="single" collapsible className="w-96">
      <Accordion.Item value="item-1">
        <Accordion.Trigger>Что такое MockInterviewAI?</Accordion.Trigger>
        <Accordion.Content>
          Сервис для проведения технических и мок-интервью в реальном времени.
        </Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="item-2">
        <Accordion.Trigger>Как создать сессию?</Accordion.Trigger>
        <Accordion.Content>
          Нажмите кнопку «Создать сессию» и пригласите участников по ссылке.
        </Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="item-3">
        <Accordion.Trigger>
          Можно ли получить подсказку от ИИ?
        </Accordion.Trigger>
        <Accordion.Content>
          Да, доступно до 3 подсказок за одно собеседование.
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  ),
};

export const Multiple: Story = {
  args: { type: "multiple" },
  render: () => (
    <Accordion type="multiple" className="w-96">
      <Accordion.Item value="item-1">
        <Accordion.Trigger>Пункт 1</Accordion.Trigger>
        <Accordion.Content>
          В режиме «multiple» можно раскрыть сразу несколько пунктов
          одновременно.
        </Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="item-2">
        <Accordion.Trigger>Пункт 2</Accordion.Trigger>
        <Accordion.Content>
          Второй раскрывающийся блок — попробуй открыть оба сразу.
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  ),
};

export const WithDisabledItem: Story = {
  args: { type: "single" },
  render: () => (
    <Accordion type="single" collapsible className="w-96">
      <Accordion.Item value="item-1">
        <Accordion.Trigger>Доступный пункт</Accordion.Trigger>
        <Accordion.Content>
          Этот пункт можно раскрыть как обычно.
        </Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="item-2" disabled>
        <Accordion.Trigger>Отключённый пункт</Accordion.Trigger>
        <Accordion.Content>
          Этот текст не должен быть виден — пункт заблокирован.
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  ),
};
