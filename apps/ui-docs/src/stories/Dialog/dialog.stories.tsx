import { Button, Dialog, Input, Label } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Dialog для Storybook.
 */
const meta = {
  title: "Components/Dialog",
  component: Dialog,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Dialog** — модальное окно

Составной компонент: **Dialog** (корень) + **Dialog.Trigger** + **Dialog.Content**
(внутри **Content** — опционально **Dialog.Header**, **Dialog.Footer**, **Dialog.Title**, **Dialog.Description**).

**Как собирать:**
\`\`\`tsx
<Dialog>
  <Dialog.Trigger asChild>
    <Button>Открыть</Button>
  </Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Заголовок</Dialog.Title>
      <Dialog.Description>Описание окна.</Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button>Сохранить</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog>
\`\`\`

Фокус-ловушка, закрытие по \`Esc\` и клику вне окна обеспечиваются самим Radix-примитивом — дополнительно ничего настраивать не нужно.

---

### **Установка и импорт**
\`\`\`tsx
import { Dialog } from "@packages/ui";
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    open: {
      control: false,
      description:
        "Управляемое состояние открытия (для контролируемого режима).",
      table: { category: "Dialog (Root)", type: { summary: "boolean" } },
    },
    defaultOpen: {
      control: "boolean",
      description: "Открыт ли диалог по умолчанию (неконтролируемый режим).",
      table: { category: "Dialog (Root)", type: { summary: "boolean" } },
    },
    onOpenChange: {
      control: false,
      description: "Коллбэк, вызывается при открытии/закрытии окна.",
      table: {
        category: "Dialog (Root)",
        type: { summary: "(open: boolean) => void" },
      },
    },
    modal: {
      control: "boolean",
      description:
        "Модальный режим (блокирует взаимодействие с остальной страницей).",
      table: { category: "Dialog (Root)", type: { summary: "boolean" } },
    },
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Стандартное окно с заголовком, описанием и кнопками в футере.
 */
export const Default: Story = {
  render: () => (
    <Dialog>
      <Dialog.Trigger asChild>
        <Button>Открыть диалог</Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Удалить собеседование?</Dialog.Title>
          <Dialog.Description>
            Это действие нельзя отменить. Все данные собеседования будут удалены
            безвозвратно.
          </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
          <Dialog.Close asChild>
            <Button variant="outline">Отмена</Button>
          </Dialog.Close>
          <Button variant="destructive">Удалить</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  ),
};

/**
 * Окно с формой внутри (например, редактирование профиля).
 */
export const WithForm: Story = {
  render: () => (
    <Dialog>
      <Dialog.Trigger asChild>
        <Button variant="outline">Редактировать профиль</Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Редактировать профиль</Dialog.Title>
          <Dialog.Description>
            Измените данные профиля и сохраните изменения.
          </Dialog.Description>
        </Dialog.Header>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Имя</Label>
            <Input id="name" defaultValue="Антон" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" defaultValue="anton@example.com" />
          </div>
        </div>
        <Dialog.Footer>
          <Button type="submit">Сохранить</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  ),
};

/**
 * Окно без крестика закрытия — закрыть можно только кнопкой в футере.
 */
export const WithoutCloseButton: Story = {
  render: () => (
    <Dialog>
      <Dialog.Trigger asChild>
        <Button variant="secondary">Открыть без крестика</Button>
      </Dialog.Trigger>
      <Dialog.Content showCloseButton={false}>
        <Dialog.Header>
          <Dialog.Title>Подтвердите действие</Dialog.Title>
          <Dialog.Description>
            Закрыть это окно можно только кнопкой ниже.
          </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
          <Dialog.Close asChild>
            <Button>Понятно</Button>
          </Dialog.Close>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  ),
};
