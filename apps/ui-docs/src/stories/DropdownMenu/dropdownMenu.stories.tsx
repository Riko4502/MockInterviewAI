import {
  CopyIcon,
  EditIcon,
  LoginIcon,
  SettingsIcon,
  TrashIcon,
  UsersIcon,
} from "@packages/icons";
import { Button, DropdownMenu } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

const meta = {
  title: "Components/DropdownMenu",
  component: DropdownMenu,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **DropdownMenu** — выпадающее меню

Компонент для меню действий (карточка кандидата, строка таблицы) и меню профиля пользователя. Поддерживает обычные пункты, чекбоксы, радио-группы, вложенные подменю, разделители и подсказки горячих клавиш.

---

### **Состояние (controlled vs uncontrolled)**

По умолчанию меню само управляет своим открытием/закрытием. Если нужно открыть/закрыть его снаружи — передайте \`open\` и \`onOpenChange\` в \`<DropdownMenu>\`.

### **Установка и импорт**
\`\`\`tsx
import { DropdownMenu } from "@packages/ui";
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    open: {
      control: "boolean",
      description: "Управляемое состояние: открыто меню или нет.",
      table: { category: "DropdownMenu (Root)", type: { summary: "boolean" } },
    },
    defaultOpen: {
      control: "boolean",
      description: "Начальное состояние для неуправляемого режима.",
      table: { category: "DropdownMenu (Root)", type: { summary: "boolean" } },
    },
    onOpenChange: {
      action: "onOpenChange",
      description: "Коллбэк при изменении состояния открыт/закрыт.",
      table: { category: "DropdownMenu (Root)" },
    },
    modal: {
      control: "boolean",
      description:
        "Модальный режим — блокирует взаимодействие с остальной страницей, пока меню открыто.",
      table: {
        category: "DropdownMenu (Root)",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
  },
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Простое меню действий — например, для карточки кандидата в списке.
 */
export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline">Действия</Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item>
          <EditIcon />
          Редактировать
        </DropdownMenu.Item>
        <DropdownMenu.Item>
          <CopyIcon />
          Дублировать
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item variant="destructive">
          <TrashIcon />
          Удалить
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  ),
};

/**
 * Пункты с подсказками горячих клавиш справа.
 */
export const WithShortcuts: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline">Файл</Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item>
          Сохранить
          <DropdownMenu.Shortcut>⌘S</DropdownMenu.Shortcut>
        </DropdownMenu.Item>
        <DropdownMenu.Item>
          Дублировать
          <DropdownMenu.Shortcut>⌘D</DropdownMenu.Shortcut>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  ),
};

/**
 * Меню профиля пользователя — заголовок (Label) и разделители между группами.
 */
export const UserMenu: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost">Иван Иванов</Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Label>Мой аккаунт</DropdownMenu.Label>
        <DropdownMenu.Separator />
        <DropdownMenu.Item>
          <UsersIcon />
          Профиль
        </DropdownMenu.Item>
        <DropdownMenu.Item>
          <SettingsIcon />
          Настройки
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item variant="destructive">
          <LoginIcon />
          Выйти
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  ),
};

/**
 * Пункты-чекбоксы — можно включать/выключать, не закрывая меню.
 */
export const WithCheckboxes: Story = {
  render: () => {
    const [showCompleted, setShowCompleted] = React.useState(true);
    const [showArchived, setShowArchived] = React.useState(false);

    return (
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button variant="outline">Фильтры</Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Label>Показывать</DropdownMenu.Label>
          <DropdownMenu.Separator />
          <DropdownMenu.CheckboxItem
            checked={showCompleted}
            onCheckedChange={setShowCompleted}
          >
            Завершённые собеседования
          </DropdownMenu.CheckboxItem>
          <DropdownMenu.CheckboxItem
            checked={showArchived}
            onCheckedChange={setShowArchived}
          >
            Архивные
          </DropdownMenu.CheckboxItem>
        </DropdownMenu.Content>
      </DropdownMenu>
    );
  },
};

/**
 * Выбрать можно только один вариант одновременно.
 */
export const WithRadioGroup: Story = {
  render: () => {
    const [status, setStatus] = React.useState("all");

    return (
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button variant="outline">Статус собеседования</Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Label>Статус</DropdownMenu.Label>
          <DropdownMenu.Separator />
          <DropdownMenu.RadioGroup value={status} onValueChange={setStatus}>
            <DropdownMenu.RadioItem value="all">Все</DropdownMenu.RadioItem>
            <DropdownMenu.RadioItem value="scheduled">
              Запланировано
            </DropdownMenu.RadioItem>
            <DropdownMenu.RadioItem value="completed">
              Завершено
            </DropdownMenu.RadioItem>
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu>
    );
  },
};

/**
 * Вложенное подменю — раскрывается при наведении на родительский пункт.
 */
export const WithSubmenu: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline">Действия</Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item>
          <EditIcon />
          Редактировать
        </DropdownMenu.Item>
        <DropdownMenu.Sub>
          <DropdownMenu.SubTrigger>Переместить в</DropdownMenu.SubTrigger>
          <DropdownMenu.SubContent>
            <DropdownMenu.Item>Активные</DropdownMenu.Item>
            <DropdownMenu.Item>Архив</DropdownMenu.Item>
          </DropdownMenu.SubContent>
        </DropdownMenu.Sub>
        <DropdownMenu.Separator />
        <DropdownMenu.Item variant="destructive">
          <TrashIcon />
          Удалить
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  ),
};
