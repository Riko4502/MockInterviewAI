import { Accordion } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "UI/Accordion",
  component: Accordion,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
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
