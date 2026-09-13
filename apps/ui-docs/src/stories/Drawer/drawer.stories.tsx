import { Button, Drawer, Input, Label, useDrawer } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

/**
 * Пропсы для интерактивной демонстрации Drawer в Storybook.
 */
interface DrawerStoryProps {
  side?: "bottom" | "top" | "left" | "right";
  showHandle?: boolean;
  showCloseButton?: boolean;
  title?: string;
  description?: string;
}

/**
 * Метаданные компонента Drawer для Storybook.
 */
const meta: Meta<DrawerStoryProps> = {
  title: "Components/Drawer",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Drawer** — шторка / панель с анимацией выдвижения

Составной компонент: **Drawer** (корень) + **Drawer.Trigger** + **Drawer.Content**
(внутри **Content** — опционально **Drawer.Handle**, **Drawer.Header**, **Drawer.Footer**, **Drawer.Title**, **Drawer.Description**).

По умолчанию выдвигается снизу (\`side="bottom"\`) с ручкой захвата (\`Drawer.Handle\`), идеально подходя для мобильных интерфейсов и быстрых действий.

---

### **Установка и импорт**
\`\`\`tsx
import { Drawer, useDrawer, DrawerProvider, UIProvider } from "@packages/ui";
\`\`\`

---

### **Составные элементы (Compound Components)**
| Элемент | Описание |
| :--- | :--- |
| **\`Drawer\`** | Корневой контейнер модального контекста (\`open\`, \`defaultOpen\`, \`onOpenChange\`, \`name\`) |
| **\`Drawer.Trigger\`** | Кнопка/элемент вызова шторки (\`asChild\`) |
| **\`Drawer.Content\`** | Панель контента (\`side\`, \`showHandle\`, \`showCloseButton\`) |
| **\`Drawer.Header\`** | Шапка шторки с выравниванием заголовка |
| **\`Drawer.Title\`** | Доступный заголовок (\`aria-labelledby\`) |
| **\`Drawer.Description\`** | Доступное описание (\`aria-describedby\`) |
| **\`Drawer.Footer\`** | Подвал с кнопками действий |
| **\`Drawer.Handle\`** | Визуальный индикатор для свайпа/перетаскивания на мобильных |
| **\`Drawer.Close\`** | Элемент закрытия шторки (\`asChild\`) |

---

### **Использование через хук \`useDrawer<Payload>()\`**
\`\`\`tsx
interface UserPayload {
  userId: string;
  name: string;
}

function MyComponent() {
  const drawer = useDrawer<UserPayload>();

  return (
    <>
      <Button onClick={() => drawer.open("user-details", { userId: "42", name: "Алексей" })}>
        Открыть профиль
      </Button>

      <Drawer name="user-details">
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Пользователь</Drawer.Title>
            <Drawer.Description>
              {drawer.get("user-details")?.name} (ID: {drawer.get("user-details")?.userId})
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Footer>
            <Button onClick={() => drawer.close("user-details")}>Закрыть</Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </>
  );
}
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    side: {
      control: "inline-radio",
      options: ["bottom", "top", "left", "right"],
      description: "Сторона выдвижения шторки на экране.",
      table: {
        category: "Drawer.Content",
        type: { summary: "'bottom' | 'top' | 'left' | 'right'" },
        defaultValue: { summary: "'bottom'" },
      },
    },
    showHandle: {
      control: "boolean",
      description:
        "Отображать ли визуальную ручку/индикатор захвата (по умолчанию true для bottom и top).",
      table: {
        category: "Drawer.Content",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
    showCloseButton: {
      control: "boolean",
      description: "Отображать ли кнопку-крестик в правом верхнем углу панели.",
      table: {
        category: "Drawer.Content",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
    title: {
      control: "text",
      description: "Текст заголовка шторки.",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
    },
    description: {
      control: "text",
      description: "Текст описания шторки.",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
    },
  },
};

export default meta;
type Story = StoryObj<DrawerStoryProps>;

/**
 * Интерактивная шторка с настраиваемыми пропсами в таблице Controls (сторона, ручка, крестик, заголовок).
 */
export const Default: Story = {
  args: {
    side: "bottom",
    showHandle: true,
    showCloseButton: true,
    title: "Параметры собеседования",
    description:
      "Настройте уровень сложности и тип вопросов для предстоящей сессии.",
  },
  render: (args) => (
    <Drawer>
      <Drawer.Trigger asChild>
        <Button>Открыть шторку ({args.side})</Button>
      </Drawer.Trigger>
      <Drawer.Content
        side={args.side}
        showHandle={args.showHandle}
        showCloseButton={args.showCloseButton}
      >
        <Drawer.Header>
          <Drawer.Title>{args.title}</Drawer.Title>
          <Drawer.Description>{args.description}</Drawer.Description>
        </Drawer.Header>
        <div className="p-6 space-y-4 max-w-lg mx-auto w-full">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-semibold text-foreground">
              Текущий режим: Live Coding + System Design
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Длительность сессии: 45 минут • Язык: TypeScript
            </p>
          </div>
        </div>
        <Drawer.Footer className="max-w-lg mx-auto w-full">
          <Button>Начать тренировку</Button>
          <Drawer.Close asChild>
            <Button variant="outline">Отмена</Button>
          </Drawer.Close>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  ),
};

interface InterviewTopicPayload {
  topicId: string;
  title: string;
  difficulty: "junior" | "middle" | "senior";
}

function UseDrawerDemo() {
  const drawer = useDrawer<InterviewTopicPayload>();
  const payload = drawer.get("topic-drawer");

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="flex gap-3">
        <Button
          onClick={() =>
            drawer.open("topic-drawer", {
              topicId: "ts-101",
              title: "TypeScript Generics & Utility Types",
              difficulty: "middle",
            })
          }
        >
          Открыть тему Middle
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            drawer.open("topic-drawer", {
              topicId: "arch-900",
              title: "Event-Driven & Microfrontends",
              difficulty: "senior",
            })
          }
        >
          Открыть тему Senior
        </Button>
      </div>

      <Drawer name="topic-drawer">
        <Drawer.Content side="bottom">
          <Drawer.Header>
            <Drawer.Title>{payload?.title ?? "Выбор темы"}</Drawer.Title>
            <Drawer.Description>
              Сложность:{" "}
              <span className="font-semibold uppercase text-primary">
                {payload?.difficulty}
              </span>{" "}
              • ID: {payload?.topicId}
            </Drawer.Description>
          </Drawer.Header>
          <div className="p-6 max-w-lg mx-auto w-full">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Шторка открыта через{" "}
              <code className="text-primary font-mono text-xs">
                drawer.open("topic-drawer", payload)
              </code>
              . Payload динамически получен через{" "}
              <code className="text-primary font-mono text-xs">
                drawer.get("topic-drawer")
              </code>
              .
            </p>
          </div>
          <Drawer.Footer className="max-w-lg mx-auto w-full">
            <Button onClick={() => drawer.allClose()}>
              Закрыть все через drawer.allClose()
            </Button>
            <Button
              variant="outline"
              onClick={() => drawer.close("topic-drawer")}
            >
              Закрыть через drawer.close("topic-drawer")
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </div>
  );
}

/**
 * Интерактивный пример работы с хуком `useDrawer<Payload>()`.
 */
export const WithHook: Story = {
  render: () => <UseDrawerDemo />,
};

/**
 * Варианты направления выдвижения шторки (`bottom`, `top`, `left`, `right`).
 */
export const Sides: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 justify-center p-4">
      {(["bottom", "top", "left", "right"] as const).map((side) => (
        <Drawer key={side}>
          <Drawer.Trigger asChild>
            <Button variant="outline">Направление: {side}</Button>
          </Drawer.Trigger>
          <Drawer.Content side={side}>
            <Drawer.Header>
              <Drawer.Title>Шторка: {side}</Drawer.Title>
              <Drawer.Description>
                Панель с направлением выдвижения{" "}
                <code className="font-mono text-xs">{side}</code>.
              </Drawer.Description>
            </Drawer.Header>
            <div className="p-6 text-sm text-muted-foreground">
              Содержимое шторки со стороны {side}.
            </div>
            <Drawer.Footer>
              <Drawer.Close asChild>
                <Button>Понятно</Button>
              </Drawer.Close>
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer>
      ))}
    </div>
  ),
};

/**
 * Форма внутри шторки с полями ввода.
 */
export const WithForm: Story = {
  render: () => {
    const [open, setOpen] = React.useState(false);
    const [name, setName] = React.useState("React Developer");

    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <Drawer.Trigger asChild>
          <Button>Редактировать должность</Button>
        </Drawer.Trigger>
        <Drawer.Content side="bottom">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setOpen(false);
            }}
          >
            <Drawer.Header>
              <Drawer.Title>Редактирование профиля собеседования</Drawer.Title>
              <Drawer.Description>
                Укажите целевую позицию для генерации вопросов.
              </Drawer.Description>
            </Drawer.Header>
            <div className="p-6 space-y-4 max-w-lg mx-auto w-full">
              <div className="space-y-1.5">
                <Label htmlFor="position">Целевая позиция</Label>
                <Input
                  id="position"
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setName(e.target.value)
                  }
                />
              </div>
            </div>
            <Drawer.Footer className="max-w-lg mx-auto w-full">
              <Button type="submit">Сохранить</Button>
              <Drawer.Close asChild>
                <Button variant="outline" type="button">
                  Отмена
                </Button>
              </Drawer.Close>
            </Drawer.Footer>
          </form>
        </Drawer.Content>
      </Drawer>
    );
  },
};
