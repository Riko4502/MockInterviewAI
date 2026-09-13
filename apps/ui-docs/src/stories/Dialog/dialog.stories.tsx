import { Button, Dialog, Input, Label } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";
import React from "react";

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
### **Состояние (controlled vs uncontrolled)**

По умолчанию Dialog сам управляет своим открытием/закрытием — стейт заводить не нужно (см. историю \`Default\`).

Если нужно закрыть или открыть диалог "снаружи" — например, автоматически закрыть после успешной отправки формы — передайте \`open\` и \`onOpenChange\` (см. историю \`WithForm\`). В этом случае вы сами управляете состоянием через \`useState\` в месте использования диалога.
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
 * Форма внутри диалога с управляемым (controlled) состоянием.
 *
 * Здесь стейт обязателен: диалог должен закрыться САМ, но только
 * после того как форма успешно отправится. Radix не умеет закрывать
 * диалог по такому "невидимому" для него событию — это нужно сделать
 * вручную через open/onOpenChange.
 */
export const WithForm: Story = {
  render: () => {
    const [open, setOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault();
      setIsSubmitting(true);

      // имитация запроса на сервер
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setIsSubmitting(false);
      setOpen(false); // закрываем диалог только после успешной отправки
    }

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <Button>Редактировать профиль</Button>
        </Dialog.Trigger>
        <Dialog.Content>
          <form onSubmit={handleSubmit}>
            <Dialog.Header>
              <Dialog.Title>Редактировать профиль</Dialog.Title>
              <Dialog.Description>
                Внесите изменения в профиль и сохраните их.
              </Dialog.Description>
            </Dialog.Header>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Имя</Label>
                <Input id="name" defaultValue="Иван Иванов" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="username">Логин</Label>
                <Input id="username" defaultValue="@ivanov" />
              </div>
            </div>
            <Dialog.Footer>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Сохранение..." : "Сохранить изменения"}
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog>
    );
  },
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
