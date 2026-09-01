import { Button, Card } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "Components/Card",
  component: Card,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    className: {
      control: "text",
      description: "Дополнительные CSS-классы для корневого `<div>` карточки.",
      table: { type: { summary: "string" } },
    },
    children: {
      control: false,
      description:
        "Содержимое карточки. Используйте sub-компоненты: " +
        "`Card.Header` — шапка (содержит Title, Description, Action); " +
        "`Card.Title` — заголовок; " +
        "`Card.Description` — подзаголовок/описание; " +
        "`Card.Action` — область действий в правом углу шапки; " +
        "`Card.Content` — основной контент; " +
        "`Card.Footer` — подвал с кнопками или итогами.",
      table: { type: { summary: "ReactNode" } },
    },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Card (root) stories ───

export const Default: Story = {
  name: "Card / Default",
  render: () => (
    <Card className="w-[360px]">
      <Card.Header>
        <Card.Title>Заголовок карточки</Card.Title>
        <Card.Description>
          Короткое описание того, что внутри карточки.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        Основной контент карточки — сюда помещается любая разметка: текст,
        изображения, списки.
      </Card.Content>
      <Card.Footer className="justify-end gap-2">
        <Button variant="outline" size="sm">
          Отмена
        </Button>
        <Button size="sm">Сохранить</Button>
      </Card.Footer>
    </Card>
  ),
};

export const WithAction: Story = {
  name: "Card / With Action",
  render: () => (
    <Card className="w-[360px]">
      <Card.Header>
        <Card.Title>Уведомление</Card.Title>
        <Card.Description>
          Новое сообщение от команды поддержки.
        </Card.Description>
        <Card.Action>
          <Button variant="ghost" size="icon-sm">
            ✕
          </Button>
        </Card.Action>
      </Card.Header>
      <Card.Content>
        Ваш запрос #4821 был обновлён. Ответ поступит в течение 24 часов.
      </Card.Content>
    </Card>
  ),
};

export const ContentOnly: Story = {
  name: "Card / Content Only",
  render: () => (
    <Card className="w-[360px]">
      <Card.Content>
        Минимальная карточка — только контент, без шапки и футера.
      </Card.Content>
    </Card>
  ),
};

// ─────────────────────────────────────────────
// Card.Header — отдельная история
// ─────────────────────────────────────────────

export const CardHeaderStory: Story = {
  name: "Card.Header",
  parameters: {
    docs: {
      description: {
        story:
          "`Card.Header` — шапка карточки (`<div>`). " +
          "Располагает дочерние элементы в сетке с авто-колонками. " +
          "Внутри размещайте: `Card.Title`, `Card.Description`, `Card.Action`.\n\n" +
          "Принимает все стандартные пропсы `<div>`: `className`, `children`.",
      },
    },
  },
  render: () => (
    <Card className="w-[360px]">
      <Card.Header>
        <Card.Title>Заголовок</Card.Title>
        <Card.Description>Описание под заголовком</Card.Description>
      </Card.Header>
    </Card>
  ),
};

// ─────────────────────────────────────────────
// Card.Title — отдельная история
// ─────────────────────────────────────────────

export const CardTitleStory: Story = {
  name: "Card.Title",
  parameters: {
    docs: {
      description: {
        story:
          "`Card.Title` — заголовок карточки (`<div>`). " +
          "Стиль: `font-semibold leading-none tracking-tight`.\n\n" +
          "Принимает все стандартные пропсы `<div>`: `className`, `children`.",
      },
    },
  },
  render: () => (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 12, width: 360 }}
    >
      <Card>
        <Card.Header>
          <Card.Title>Стандартный заголовок</Card.Title>
        </Card.Header>
      </Card>
      <Card>
        <Card.Header>
          <Card.Title className="text-lg text-primary">
            Кастомный стиль через className
          </Card.Title>
        </Card.Header>
      </Card>
    </div>
  ),
};

// ─────────────────────────────────────────────
// Card.Description — отдельная история
// ─────────────────────────────────────────────

export const CardDescriptionStory: Story = {
  name: "Card.Description",
  parameters: {
    docs: {
      description: {
        story:
          "`Card.Description` — подзаголовок/описание карточки (`<div>`). " +
          "Стиль: `text-sm text-muted-foreground`. " +
          "Размещается внутри `Card.Header`, после `Card.Title`.\n\n" +
          "Принимает все стандартные пропсы `<div>`: `className`, `children`.",
      },
    },
  },
  render: () => (
    <Card className="w-[360px]">
      <Card.Header>
        <Card.Title>Сессия интервью</Card.Title>
        <Card.Description>
          Техническое собеседование по React и TypeScript. Длительность 60
          минут.
        </Card.Description>
      </Card.Header>
    </Card>
  ),
};

// ─────────────────────────────────────────────
// Card.Action — отдельная история
// ─────────────────────────────────────────────

export const CardActionStory: Story = {
  name: "Card.Action",
  parameters: {
    docs: {
      description: {
        story:
          "`Card.Action` — область действий в правом верхнем углу шапки (`<div>`). " +
          "Автоматически выравнивается по правому краю через CSS Grid (`col-start-2 row-span-2`). " +
          "Используйте для кнопок закрытия, меню опций, ссылок.\n\n" +
          "Принимает все стандартные пропсы `<div>`: `className`, `children`.",
      },
    },
  },
  render: () => (
    <Card className="w-[360px]">
      <Card.Header>
        <Card.Title>С кнопкой действия</Card.Title>
        <Card.Description>Нажмите × чтобы закрыть</Card.Description>
        <Card.Action>
          <Button variant="ghost" size="icon-sm">
            ✕
          </Button>
        </Card.Action>
      </Card.Header>
      <Card.Content>Контент карточки</Card.Content>
    </Card>
  ),
};

// ─────────────────────────────────────────────
// Card.Content — отдельная история
// ─────────────────────────────────────────────

export const CardContentStory: Story = {
  name: "Card.Content",
  parameters: {
    docs: {
      description: {
        story:
          "`Card.Content` — основная область контента карточки (`<div>`). " +
          "Стиль: `px-6 pb-6`. Принимает любой JSX: текст, компоненты, списки, формы.\n\n" +
          "Принимает все стандартные пропсы `<div>`: `className`, `children`.",
      },
    },
  },
  render: () => (
    <Card className="w-[360px]">
      <Card.Header>
        <Card.Title>Профиль кандидата</Card.Title>
      </Card.Header>
      <Card.Content>
        <ul style={{ listStyle: "disc", paddingLeft: 20, lineHeight: 2 }}>
          <li>5 лет опыта в React</li>
          <li>TypeScript, Node.js, PostgreSQL</li>
          <li>Английский — B2</li>
        </ul>
      </Card.Content>
    </Card>
  ),
};

// ─────────────────────────────────────────────
// Card.Footer — отдельная история
// ─────────────────────────────────────────────

export const CardFooterStory: Story = {
  name: "Card.Footer",
  parameters: {
    docs: {
      description: {
        story:
          "`Card.Footer` — подвал карточки (`<div>`). " +
          "Стиль: `px-6 pb-6 flex items-center`. " +
          "Используется для кнопок, итогов, пагинации.\n\n" +
          "Принимает все стандартные пропсы `<div>`: `className`, `children`.",
      },
    },
  },
  render: () => (
    <Card className="w-[360px]">
      <Card.Content>Контент карточки</Card.Content>
      <Card.Footer className="justify-end gap-2">
        <Button variant="outline" size="sm">
          Отмена
        </Button>
        <Button size="sm">Применить</Button>
      </Card.Footer>
    </Card>
  ),
};
