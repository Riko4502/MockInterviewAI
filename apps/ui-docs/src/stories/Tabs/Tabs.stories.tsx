import {
  BellIcon,
  CodeIcon,
  PlayIcon,
  SettingsIcon,
  UsersIcon,
  WandIcon,
} from "@packages/icons";
import { Badge, Button, Card, Input, Label, Tabs } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Tabs для Storybook.
 */
const meta = {
  title: "Components/Tabs",
  component: Tabs,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Tabs** — компонент навигационных вкладок

Компонент для переключения между несколькими экранами контента в одном представлении. Построен на базе доступного примитива \`radix-ui\` с полной поддержкой клавиатурной навигации (\`ArrowLeft\`, \`ArrowRight\`, \`Home\`, \`End\`) и screen readers.

---

### **Установка и импорт**
\`\`\`tsx
import { Tabs } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<Tabs defaultValue="account">
  <Tabs.List>
    <Tabs.Trigger value="account">Аккаунт</Tabs.Trigger>
    <Tabs.Trigger value="password">Пароль</Tabs.Trigger>
  </Tabs.List>

  <Tabs.Content value="account">
    Контент аккаунта...
  </Tabs.Content>
  <Tabs.Content value="password">
    Форма смены пароля...
  </Tabs.Content>
</Tabs>
\`\`\`

---

### **Составные элементы (Compound Components)**
| Элемент | Описание |
| :--- | :--- |
| **\`Tabs\`** | Корневой контейнер контекста вкладок (\`variant\`, \`size\`, \`value\`, \`defaultValue\`, \`orientation\`) |
| **\`Tabs.List\`** | Панель списка переключателей вкладок (\`variant\`, \`size\`) |
| **\`Tabs.Trigger\`** | Интерактивная кнопка вкладки (\`value\`, \`disabled\`) |
| **\`Tabs.Content\`** | Панель содержимого активной вкладки с плавной анимацией появления |

---

### **Стилистические варианты (\`variant\`)**
* **\`default\`** (или \`pill\`) — современный segmented control с фоном \`bg-muted\` и белой карточкой активного таба;
* **\`line\`** — классические вкладки с нижней линией подчеркивания активного элемента (\`border-primary\`);
* **\`card\`** — карточные вкладки с верхней рамкой.
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "line", "card"],
      description:
        "Стилистический вариант отображения списка и кнопок вкладок.",
      table: {
        type: { summary: '"default" | "line" | "card"' },
        defaultValue: { summary: '"default"' },
      },
    },
    size: {
      control: "select",
      options: ["sm", "default", "lg"],
      description: "Размер кнопок и шрифта вкладок.",
      table: {
        type: { summary: '"sm" | "default" | "lg"' },
        defaultValue: { summary: '"default"' },
      },
    },
    defaultValue: {
      control: "text",
      description: "Значение вкладки, активной по умолчанию.",
      table: {
        type: { summary: "string" },
      },
    },
    orientation: {
      control: "select",
      options: ["horizontal", "vertical"],
      description: "Ориентация вкладок (горизонтальная или вертикальная).",
      table: {
        type: { summary: '"horizontal" | "vertical"' },
        defaultValue: { summary: '"horizontal"' },
      },
    },
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Стандартный интерактивный вариант вкладок (переключайте Controls: variant, size, orientation).
 */
export const Default: Story = {
  args: {
    variant: "default",
    size: "default",
    orientation: "horizontal",
    defaultValue: "general",
  },
  render: (args) => (
    <div className="w-[520px] max-w-full">
      <Tabs {...args} defaultValue={args.defaultValue ?? "general"}>
        <Tabs.List>
          <Tabs.Trigger value="general">Общие</Tabs.Trigger>
          <Tabs.Trigger value="security">Безопасность</Tabs.Trigger>
          <Tabs.Trigger value="notifications">Уведомления</Tabs.Trigger>
        </Tabs.List>

        <div className={args.orientation === "vertical" ? "flex-1" : undefined}>
          <Tabs.Content value="general">
            <Card className="p-4 space-y-3">
              <h4 className="font-semibold text-foreground text-sm">
                Настройки профиля
              </h4>
              <p className="text-xs text-muted-foreground">
                Управляйте вашим именем, электронной почтой и языковыми
                предпочтениями.
              </p>
              <div className="space-y-2 pt-2">
                <Label>Имя пользователя</Label>
                <Input defaultValue="Алексей Смирнов" />
              </div>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="security">
            <Card className="p-4 space-y-3">
              <h4 className="font-semibold text-foreground text-sm">
                Параметры безопасности
              </h4>
              <p className="text-xs text-muted-foreground">
                Измените пароль или включите двухфакторную аутентификацию (2FA).
              </p>
              <div className="space-y-2 pt-2">
                <Label>Новый пароль</Label>
                <Input type="password" placeholder="••••••••••••" />
              </div>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="notifications">
            <Card className="p-4 space-y-3">
              <h4 className="font-semibold text-foreground text-sm">
                Центр уведомлений
              </h4>
              <p className="text-xs text-muted-foreground">
                Настройте каналы получения уведомлений о новых сессиях
                собеседований.
              </p>
            </Card>
          </Tabs.Content>
        </div>
      </Tabs>
    </div>
  ),
};

/**
 * Вариант с подчеркиванием (Line / Underline).
 */
export const LineVariant: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Вкладки со стилем `variant="line"` идеально подходят для оформления верхнего уровня страниц и профилей.',
      },
    },
  },
  render: () => (
    <div className="w-[520px] max-w-full">
      <Tabs defaultValue="candidates" variant="line">
        <Tabs.List>
          <Tabs.Trigger value="candidates">Кандидаты</Tabs.Trigger>
          <Tabs.Trigger value="interviews">Интервью</Tabs.Trigger>
          <Tabs.Trigger value="analytics">Аналитика</Tabs.Trigger>
          <Tabs.Trigger value="settings">Параметры</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="candidates" className="pt-2">
          <p className="text-sm text-muted-foreground">
            Список активных кандидатов и прогресс прохождения тестовых заданий.
          </p>
        </Tabs.Content>
        <Tabs.Content value="interviews" className="pt-2">
          <p className="text-sm text-muted-foreground">
            Расписание назначенных и завершенных сессий AI-интервью.
          </p>
        </Tabs.Content>
        <Tabs.Content value="analytics" className="pt-2">
          <p className="text-sm text-muted-foreground">
            Статистика успешности кандидатов по грейдам и стеку технологий.
          </p>
        </Tabs.Content>
        <Tabs.Content value="settings" className="pt-2">
          <p className="text-sm text-muted-foreground">
            Конфигурация вопросов и критериев оценки AI-ассистента.
          </p>
        </Tabs.Content>
      </Tabs>
    </div>
  ),
};

/**
 * Карточный стиль вкладок (Card variant).
 */
export const CardVariant: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Карточный вариант `variant="card"` органично связывается с контентной карточкой под вкладками.',
      },
    },
  },
  render: () => (
    <div className="w-[480px] max-w-full">
      <Tabs defaultValue="tab1" variant="card">
        <Tabs.List>
          <Tabs.Trigger value="tab1">Редактор кода</Tabs.Trigger>
          <Tabs.Trigger value="tab2">Консоль вывода</Tabs.Trigger>
          <Tabs.Trigger value="tab3">Тесты</Tabs.Trigger>
        </Tabs.List>

        <Card className="rounded-tl-none p-4 mt-0">
          <Tabs.Content value="tab1" className="mt-0">
            <p className="text-xs font-mono text-muted-foreground">
              function solve(arr: number[]): number &#123; return arr.length;
              &#125;
            </p>
          </Tabs.Content>
          <Tabs.Content value="tab2" className="mt-0">
            <p className="text-xs font-mono text-success">
              ✓ Output: Process finished with exit code 0
            </p>
          </Tabs.Content>
          <Tabs.Content value="tab3" className="mt-0">
            <p className="text-xs text-muted-foreground">
              4/4 unit-тестов успешно пройдены.
            </p>
          </Tabs.Content>
        </Card>
      </Tabs>
    </div>
  ),
};

/**
 * Вкладки с иконками и бейджами со счетчиками.
 */
export const WithIconsAndBadges: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Кнопки `Tabs.Trigger` поддерживают иконки из `@packages/icons` и бейджи `Badge`.",
      },
    },
  },
  render: () => (
    <div className="w-[560px] max-w-full">
      <Tabs defaultValue="sessions">
        <Tabs.List>
          <Tabs.Trigger value="sessions">
            <PlayIcon size="xs" />
            <span>Сессии</span>
            <Badge
              variant="statusInfo"
              className="ml-1 px-1.5 py-0 text-[10px]"
            >
              12
            </Badge>
          </Tabs.Trigger>

          <Tabs.Trigger value="team">
            <UsersIcon size="xs" />
            <span>Команда</span>
          </Tabs.Trigger>

          <Tabs.Trigger value="ai">
            <WandIcon size="xs" />
            <span>AI Ассистент</span>
            <Badge
              variant="statusSuccess"
              className="ml-1 px-1.5 py-0 text-[10px]"
            >
              Pro
            </Badge>
          </Tabs.Trigger>

          <Tabs.Trigger value="notifications">
            <BellIcon size="xs" />
            <span>Уведомления</span>
            <Badge
              variant="statusDanger"
              className="ml-1 px-1.5 py-0 text-[10px]"
            >
              3
            </Badge>
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="sessions" className="pt-2">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">
              12 активных сессий собеседований на этой неделе.
            </p>
          </Card>
        </Tabs.Content>
        <Tabs.Content value="team" className="pt-2">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">
              Список интервьюеров и распределение ролей в системе.
            </p>
          </Card>
        </Tabs.Content>
        <Tabs.Content value="ai" className="pt-2">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">
              Продвинутая модель оценки ответов и генерации задач.
            </p>
          </Card>
        </Tabs.Content>
        <Tabs.Content value="notifications" className="pt-2">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">
              3 непрочитанных сообщения от кандидатов.
            </p>
          </Card>
        </Tabs.Content>
      </Tabs>
    </div>
  ),
};

/**
 * Размеры вкладок (sm, default, lg).
 */
export const Sizes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Поддержка трех стандартных размеров: `sm` (компактный), `default` (стандартный) и `lg` (крупный).",
      },
    },
  },
  render: () => (
    <div className="w-[500px] max-w-full space-y-6">
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Размер sm (Small):
        </span>
        <Tabs defaultValue="t1" size="sm">
          <Tabs.List>
            <Tabs.Trigger value="t1">Дневной</Tabs.Trigger>
            <Tabs.Trigger value="t2">Недельный</Tabs.Trigger>
            <Tabs.Trigger value="t3">Месячный</Tabs.Trigger>
          </Tabs.List>
        </Tabs>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Размер default (Medium):
        </span>
        <Tabs defaultValue="t1" size="default">
          <Tabs.List>
            <Tabs.Trigger value="t1">Дневной</Tabs.Trigger>
            <Tabs.Trigger value="t2">Недельный</Tabs.Trigger>
            <Tabs.Trigger value="t3">Месячный</Tabs.Trigger>
          </Tabs.List>
        </Tabs>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Размер lg (Large):
        </span>
        <Tabs defaultValue="t1" size="lg">
          <Tabs.List>
            <Tabs.Trigger value="t1">Дневной</Tabs.Trigger>
            <Tabs.Trigger value="t2">Недельный</Tabs.Trigger>
            <Tabs.Trigger value="t3">Месячный</Tabs.Trigger>
          </Tabs.List>
        </Tabs>
      </div>
    </div>
  ),
};

/**
 * Вертикальная ориентация (Vertical orientation).
 */
export const VerticalOrientation: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'При установке `orientation="vertical"` список вкладок располагается вертикально слева от контента.',
      },
    },
  },
  render: () => (
    <div className="w-[540px] max-w-full">
      <Tabs defaultValue="account" orientation="vertical">
        <Tabs.List>
          <Tabs.Trigger value="account" className="gap-2">
            <UsersIcon size="xs" />
            <span>Аккаунт</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="code" className="gap-2">
            <CodeIcon size="xs" />
            <span>Песочница</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="settings" className="gap-2">
            <SettingsIcon size="xs" />
            <span>Настройки</span>
          </Tabs.Trigger>
        </Tabs.List>

        <div className="flex-1">
          <Tabs.Content value="account">
            <Card className="p-4 space-y-2">
              <h4 className="text-sm font-semibold">Управление аккаунтом</h4>
              <p className="text-xs text-muted-foreground">
                Данные профиля, роли и права доступа.
              </p>
              <Button size="sm" className="mt-2">
                Редактировать
              </Button>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="code">
            <Card className="p-4 space-y-2">
              <h4 className="text-sm font-semibold">Песочница кода</h4>
              <p className="text-xs text-muted-foreground">
                Быстрое тестирование сниппетов перед собеседованием.
              </p>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="settings">
            <Card className="p-4 space-y-2">
              <h4 className="text-sm font-semibold">Системные параметры</h4>
              <p className="text-xs text-muted-foreground">
                Интеграции с внешними сервисами и API ключи.
              </p>
            </Card>
          </Tabs.Content>
        </div>
      </Tabs>
    </div>
  ),
};

/**
 * Заблокированная вкладка (Disabled state).
 */
export const DisabledTab: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Вкладка с атрибутом `disabled` недоступна для кликов и клавиатурного фокуса.",
      },
    },
  },
  render: () => (
    <div className="w-[440px] max-w-full">
      <Tabs defaultValue="active1">
        <Tabs.List>
          <Tabs.Trigger value="active1">Доступно</Tabs.Trigger>
          <Tabs.Trigger value="active2">В процессе</Tabs.Trigger>
          <Tabs.Trigger value="disabled" disabled>
            Архив (Disabled)
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="active1" className="pt-2">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">
              Активный контент доступен для взаимодействия.
            </p>
          </Card>
        </Tabs.Content>
        <Tabs.Content value="active2" className="pt-2">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">
              Процесс выполнения задач.
            </p>
          </Card>
        </Tabs.Content>
      </Tabs>
    </div>
  ),
};
