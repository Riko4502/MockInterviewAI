import { PlayIcon, WandIcon } from "@packages/icons";
import { Badge, Button, Card, Input, Label } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Card для Storybook.
 */
const meta = {
  title: "Components/Card",
  component: Card,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Card** — универсальный карточный контейнер

Основной строительный блок интерфейса для группировки связанной информации, форм, дашбордов и аналитики. Состоит из модульных составных элементов: \`Card\`, \`Card.Header\`, \`Card.Title\`, \`Card.Description\`, \`Card.Action\`, \`Card.Content\`, \`Card.Footer\`.

---

### **Установка и импорт**
\`\`\`tsx
import { Card } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<Card className="w-96">
  <Card.Header>
    <Card.Title>Сессия собеседования</Card.Title>
    <Card.Description>Frontend Developer (React, TypeScript)</Card.Description>
  </Card.Header>
  <Card.Content>
    Контент карточки...
  </Card.Content>
  <Card.Footer>
    <Button size="sm">Начать</Button>
  </Card.Footer>
</Card>
\`\`\`
`,
      },
    },
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
        "Содержимое карточки (`Card.Header`, `Card.Title`, `Card.Description`, `Card.Action`, `Card.Content`, `Card.Footer`).",
      table: { type: { summary: "ReactNode" } },
    },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Стандартная карточка с заголовком, описанием, контентом и кнопками действий.
 */
export const Default: Story = {
  render: () => (
    <Card className="w-[380px]">
      <Card.Header>
        <Card.Title>Собеседование по алгоритмам</Card.Title>
        <Card.Description>
          Оценка решения алгоритмических задач и структур данных.
        </Card.Description>
      </Card.Header>
      <Card.Content className="space-y-3 text-sm text-muted-foreground">
        <p>
          Кандидату будет предложено 3 задачи на бинарные деревья и динамическое
          программирование.
        </p>
        <div className="flex items-center gap-2">
          <Badge variant="statusInfo">Длительность: 45 мин</Badge>
          <Badge variant="statusSuccess">AI Оценка</Badge>
        </div>
      </Card.Content>
      <Card.Footer className="justify-end gap-2">
        <Button variant="outline" size="sm">
          Отмена
        </Button>
        <Button size="sm">
          <PlayIcon size="xs" />
          Начать
        </Button>
      </Card.Footer>
    </Card>
  ),
};

/**
 * Карточка с действием в правом верхнем углу (`Card.Action`).
 */
export const WithHeaderAction: Story = {
  render: () => (
    <Card className="w-[420px]">
      <Card.Header>
        <div>
          <Card.Title>AI Аналитика сессии</Card.Title>
          <Card.Description>
            Сводный отчет по результатам ответов
          </Card.Description>
        </div>
        <Card.Action>
          <Button variant="secondary" size="xs">
            <WandIcon size="xs" />
            Экспорт
          </Button>
        </Card.Action>
      </Card.Header>
      <Card.Content className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Точность ответов:</span>
          <span className="font-semibold text-success">94%</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Время на задачу:</span>
          <span className="font-medium">18 мин</span>
        </div>
      </Card.Content>
    </Card>
  ),
};

/**
 * Карточка формы ввода настроек.
 */
export const FormCard: Story = {
  render: () => (
    <Card className="w-[380px]">
      <Card.Header>
        <Card.Title>Настройка критериев</Card.Title>
        <Card.Description>
          Задайте минимальный балл прохождения
        </Card.Description>
      </Card.Header>
      <Card.Content className="space-y-3">
        <div className="space-y-1.5">
          <Label>Проходной балл (0-100)</Label>
          <Input defaultValue="75" type="number" />
        </div>
      </Card.Content>
      <Card.Footer className="justify-between">
        <Button variant="ghost" size="sm">
          Сбросить
        </Button>
        <Button size="sm">Сохранить</Button>
      </Card.Footer>
    </Card>
  ),
};
