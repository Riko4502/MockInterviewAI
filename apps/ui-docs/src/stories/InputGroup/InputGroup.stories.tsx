import { CloseIcon, CopyIcon, SearchIcon, WandIcon } from "@packages/icons";
import { Button, Input, InputGroup } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

/**
 * Метаданные компонента InputGroup для Storybook.
 */
const meta = {
  title: "Components/InputGroup",
  component: InputGroup,
  subcomponents: {
    "InputGroup.Prefix": InputGroup.Prefix,
    "InputGroup.Suffix": InputGroup.Suffix,
    "InputGroup.Addon": InputGroup.Addon,
  },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### Описание компонента InputGroup

Компонент **InputGroup** предназначен для комбинирования текстового поля \`<Input />\` с иконками, кнопками и текстовыми аддонами.

#### Составные элементы:
* **\`InputGroup\`** — корневой контейнер-обертка.
* **\`InputGroup.Prefix\`** — слот для иконки или текстового символа слева внутри инпута.
* **\`InputGroup.Suffix\`** — слот для иконки, кнопки действия или текста справа внутри инпута.
* **\`InputGroup.Addon\`** (или \`InputGroup.Text\`) — прикрепляемый внешний блок (например, \`https://\`).

#### Основные пропсы InputGroup:
* **\`attached\`** (\`boolean\`, default: \`false\`) — включает режим склейки границ для внешних аддонов и кнопок.
* **\`prefix\`** (\`ReactNode\`) — удобный shorthand-проп для передачи левого элемента.
* **\`suffix\`** (\`ReactNode\`) — удобный shorthand-проп для передачи правого элемента.
        `,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    attached: {
      control: "boolean",
      description:
        "Режим прикрепленных внешних аддонов и кнопок (склейка границ)",
      table: {
        defaultValue: { summary: "false" },
        type: { summary: "boolean" },
      },
    },
    prefix: {
      control: false,
      description: "Слот или иконка префикса слева внутри инпута (shorthand)",
    },
    suffix: {
      control: false,
      description:
        "Слот, иконка или кнопка суффикса справа внутри инпута (shorthand)",
    },
  },
  args: {
    attached: false,
  },
} satisfies Meta<typeof InputGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Базовый пример с возможностью интерактивного переключения пропсов в Controls.
 */
export const Default: Story = {
  render: (args) => (
    <div className="w-80">
      <InputGroup {...args}>
        <InputGroup.Prefix>
          <SearchIcon size="sm" />
        </InputGroup.Prefix>
        <Input placeholder="Поиск по вопросам или темам..." />
      </InputGroup>
    </div>
  ),
};

/**
 * Поле ввода с иконкой поиска слева (Prefix).
 */
export const WithPrefixIcon: Story = {
  render: (args) => (
    <div className="w-80">
      <InputGroup {...args}>
        <InputGroup.Prefix>
          <SearchIcon size="sm" />
        </InputGroup.Prefix>
        <Input placeholder="Поиск по вопросам или темам..." />
      </InputGroup>
    </div>
  ),
};

/**
 * Поле ввода с интерактивной кнопкой копирования справа (Suffix).
 */
export const WithSuffixAction: Story = {
  render: (args) => {
    const [copied, setCopied] = React.useState(false);
    const value = "https://mockinterview.ai/invite/7f8a9b";

    const handleCopy = () => {
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="w-96">
        <InputGroup {...args}>
          <Input defaultValue={value} readOnly />
          <InputGroup.Suffix>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={handleCopy}
              aria-label="Скопировать ссылку"
              className="cursor-pointer"
            >
              <CopyIcon size="xs" />
            </Button>
          </InputGroup.Suffix>
        </InputGroup>
        {copied && (
          <span className="text-xs text-success mt-1 block">
            Ссылка скопирована в буфер обмена!
          </span>
        )}
      </div>
    );
  },
};

/**
 * Поле ввода с префиксом и кнопкой очистки (Suffix).
 */
export const WithPrefixAndClear: Story = {
  render: (args) => {
    const [query, setQuery] = React.useState("React hooks");

    return (
      <div className="w-80">
        <InputGroup {...args}>
          <InputGroup.Prefix>
            <SearchIcon size="sm" />
          </InputGroup.Prefix>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Введите запрос..."
          />
          {query && (
            <InputGroup.Suffix>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => setQuery("")}
                aria-label="Очистить поле"
                className="cursor-pointer"
              >
                <CloseIcon size="xs" />
              </Button>
            </InputGroup.Suffix>
          )}
        </InputGroup>
      </div>
    );
  },
};

/**
 * Использование через удобные краткие пропсы (Shorthand prefix / suffix).
 */
export const ShorthandProps: Story = {
  render: (args) => (
    <div className="w-80">
      <InputGroup {...args} prefix={<SearchIcon size="sm" />}>
        <Input placeholder="Быстрый поиск..." />
      </InputGroup>
    </div>
  ),
};

/**
 * Поле ввода с прикрепленным текстовым аддоном (Attached Addon).
 */
export const AttachedAddon: Story = {
  args: {
    attached: true,
  },
  render: (args) => (
    <div className="flex flex-col gap-4 w-96">
      <InputGroup {...args}>
        <InputGroup.Addon>https://</InputGroup.Addon>
        <Input placeholder="mysite.com" />
      </InputGroup>

      <InputGroup {...args}>
        <InputGroup.Addon>@</InputGroup.Addon>
        <Input placeholder="username" />
        <InputGroup.Addon>.dev</InputGroup.Addon>
      </InputGroup>
    </div>
  ),
};

/**
 * Поле ввода с прикрепленной кнопкой (Attached Button).
 */
export const AttachedButton: Story = {
  args: {
    attached: true,
  },
  render: (args) => (
    <div className="flex flex-col gap-4 w-96">
      <InputGroup {...args}>
        <Input placeholder="Поиск кандидата..." />
        <Button variant="default">
          <SearchIcon size="sm" />
          Найти
        </Button>
      </InputGroup>

      <InputGroup {...args}>
        <Input placeholder="Сгенерировать вопросы через AI..." />
        <Button variant="secondary">
          <WandIcon size="sm" />
          Генерировать
        </Button>
      </InputGroup>
    </div>
  ),
};
