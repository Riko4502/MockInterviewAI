import type { Meta, StoryObj } from "@storybook/react";
import { Card, Button } from "@packages/ui";

const meta = {
  title: "Components/Card",
  component: Card,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-[360px]">
      <Card.Header>
        <Card.Title>Заголовок карточки</Card.Title>
        <Card.Description>Короткое описание того, что внутри карточки.</Card.Description>
      </Card.Header>
      <Card.Content>
        Основной контент карточки — сюда помещается любая разметка: текст, изображения, списки.
      </Card.Content>
      <Card.Footer className="justify-end gap-2">
        <Button variant="outline" size="sm">Отмена</Button>
        <Button size="sm">Сохранить</Button>
      </Card.Footer>
    </Card>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Card className="w-[360px]">
      <Card.Header>
        <Card.Title>Уведомление</Card.Title>
        <Card.Description>Новое сообщение от команды поддержки.</Card.Description>
        <Card.Action>
          <Button variant="ghost" size="icon-sm">✕</Button>
        </Card.Action>
      </Card.Header>
      <Card.Content>
        Ваш запрос #4821 был обновлён. Ответ поступит в течение 24 часов.
      </Card.Content>
    </Card>
  ),
};

export const ContentOnly: Story = {
  render: () => (
    <Card className="w-[360px]">
      <Card.Content>
        Минимальная карточка — только контент, без шапки и футера.
      </Card.Content>
    </Card>
  ),
};
