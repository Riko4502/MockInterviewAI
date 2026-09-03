import { Field } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

// ─────────────────────────────────────────────
// Field (корневой компонент)
// ─────────────────────────────────────────────

const meta = {
  title: "Components/Form/Field",
  component: Field,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: "select",
      options: ["vertical", "horizontal", "responsive"],
      description:
        "Ориентация поля формы. `vertical` — лейбл над инпутом (по умолчанию); " +
        "`horizontal` — лейбл слева от инпута в ряд; " +
        "`responsive` — `vertical` на мобильных, `horizontal` на широких экранах.",
      table: {
        type: { summary: '"vertical" | "horizontal" | "responsive"' },
        defaultValue: { summary: '"vertical"' },
      },
    },
    invalid: {
      control: "boolean",
      description:
        "Переводит поле в состояние ошибки. Меняет цвет лейбла на `destructive` и " +
        "передаёт состояние во вложенные `Field.Label` и `Field.Error`.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    children: {
      control: false,
      description:
        "Содержимое поля. Используйте sub-компоненты: " +
        "`Field.Label` — лейбл; `Field.Content` — обёртка для инпута; " +
        "`Field.Description` — подсказка; `Field.Error` — ошибка валидации.",
      table: { type: { summary: "ReactNode" } },
    },
    className: {
      control: "text",
      description: "Дополнительные CSS-классы для корневого элемента поля.",
      table: { type: { summary: "string" } },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: "100%", maxWidth: 400 }}>
        <Story />
      </div>
    ),
  ],
} as Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof Field>;

// ─── Field (root) stories ───

export const Vertical: Story = {
  name: "Field / Vertical",
  args: {
    orientation: "vertical",
    children: (
      <>
        <Field.Label>Email</Field.Label>
        <Field.Content>
          <input
            className="flex h-[46px] w-full min-w-0 rounded-lg border border-input bg-background px-4 py-[13px] text-sm text-foreground placeholder:text-muted-foreground outline-none"
            placeholder="example@mail.com"
          />
          <Field.Error>Обязательное поле</Field.Error>
        </Field.Content>
      </>
    ),
  },
};

export const Horizontal: Story = {
  name: "Field / Horizontal",
  args: {
    orientation: "horizontal",
    children: (
      <>
        <Field.Label className="w-20 shrink-0 h-[46px] flex items-center">
          Email
        </Field.Label>
        <Field.Content>
          <input
            className="flex h-[46px] w-full min-w-[280px] rounded-lg border border-input bg-background px-4 py-[13px] text-sm text-foreground placeholder:text-muted-foreground outline-none"
            placeholder="example@mail.com"
          />
          <Field.Error>Обязательное поле</Field.Error>
        </Field.Content>
      </>
    ),
  },
};

export const WithDescription: Story = {
  name: "Field / With Description",
  args: {
    children: (
      <>
        <Field.Label>Email</Field.Label>
        <Field.Content>
          <Field.Description>Введите ваш email для входа</Field.Description>
          <input
            className="flex h-[46px] w-full min-w-0 rounded-lg border border-input bg-background px-4 py-[13px] text-sm text-foreground placeholder:text-muted-foreground outline-none"
            placeholder="example@mail.com"
          />
          <Field.Error />
        </Field.Content>
      </>
    ),
  },
};

export const Invalid: Story = {
  name: "Field / Invalid State",
  args: {
    invalid: true,
    children: (
      <>
        <Field.Label>Email</Field.Label>
        <Field.Content>
          <input
            className="flex h-[46px] w-full min-w-0 rounded-lg border border-destructive bg-background px-4 py-[13px] text-sm text-foreground placeholder:text-muted-foreground outline-none"
            placeholder="example@mail.com"
            aria-invalid={true}
          />
          <Field.Error>Некорректный формат email</Field.Error>
        </Field.Content>
      </>
    ),
  },
};

export const Valid: Story = {
  name: "Field / Valid (no error)",
  args: {
    children: (
      <>
        <Field.Label>Email</Field.Label>
        <Field.Content>
          <input
            className="flex h-[46px] w-full min-w-0 rounded-lg border border-input bg-background px-4 py-[13px] text-sm text-foreground placeholder:text-muted-foreground outline-none"
            placeholder="example@mail.com"
          />
          <Field.Error />
        </Field.Content>
      </>
    ),
  },
};

// ─────────────────────────────────────────────
// Field.Label — отдельная история
// ─────────────────────────────────────────────

export const FieldLabelStory: Story = {
  name: "Field.Label",
  parameters: {
    docs: {
      description: {
        story:
          "`Field.Label` — лейбл поля. Автоматически привязывается к инпуту через `htmlFor` " +
          "(берёт `inputId` из контекста `Field`). При `invalid=true` на родителе окрашивается в `destructive`. " +
          "Принимает все стандартные пропсы `<label>`: `className`, `children`, `onClick` и т.д.",
      },
    },
  },
  render: () => (
    <Field>
      <Field.Label>Имя пользователя</Field.Label>
      <Field.Content>
        <input
          className="flex h-[46px] w-full min-w-0 rounded-lg border border-input bg-background px-4 py-[13px] text-sm text-foreground outline-none"
          placeholder="username"
        />
      </Field.Content>
    </Field>
  ),
};

// ─────────────────────────────────────────────
// Field.Description — отдельная история
// ─────────────────────────────────────────────

export const FieldDescriptionStory: Story = {
  name: "Field.Description",
  parameters: {
    docs: {
      description: {
        story:
          "`Field.Description` — вспомогательный текст под инпутом. Отображается серым (`text-muted-foreground`). " +
          "Размещается внутри `Field.Content` до или после инпута. " +
          "Принимает стандартные пропсы `<p>`: `className`, `children`.",
      },
    },
  },
  render: () => (
    <Field>
      <Field.Label>Пароль</Field.Label>
      <Field.Content>
        <Field.Description>
          Минимум 8 символов, должен содержать цифры и буквы.
        </Field.Description>
        <input
          type="password"
          className="flex h-[46px] w-full min-w-0 rounded-lg border border-input bg-background px-4 py-[13px] text-sm text-foreground outline-none"
          placeholder="••••••••"
        />
      </Field.Content>
    </Field>
  ),
};

// ─────────────────────────────────────────────
// Field.Error — отдельная история
// ─────────────────────────────────────────────

export const FieldErrorStory: Story = {
  name: "Field.Error",
  parameters: {
    docs: {
      description: {
        story:
          '`Field.Error` — сообщение об ошибке валидации (`role="alert"`, `text-destructive`). ' +
          "**Два способа передать ошибку:**\n\n" +
          "1. `children` — строка или JSX напрямую\n" +
          "2. `errors` — массив `Array<{ message?: string }>` (интеграция с react-hook-form). " +
          "При нескольких уникальных ошибках рендерит `<ul>`. Ничего не рендерит, если контента нет.",
      },
    },
  },
  render: () => (
    <div className="flex flex-col gap-6" style={{ width: 400 }}>
      <Field invalid>
        <Field.Label>Email (через children)</Field.Label>
        <Field.Content>
          <input
            className="flex h-[46px] w-full min-w-0 rounded-lg border border-destructive bg-background px-4 py-[13px] text-sm text-foreground outline-none"
            placeholder="example@mail.com"
            aria-invalid={true}
          />
          <Field.Error>Некорректный формат email</Field.Error>
        </Field.Content>
      </Field>

      <Field invalid>
        <Field.Label>Пароль (через prop errors)</Field.Label>
        <Field.Content>
          <input
            type="password"
            className="flex h-[46px] w-full min-w-0 rounded-lg border border-destructive bg-background px-4 py-[13px] text-sm text-foreground outline-none"
            placeholder="••••••••"
            aria-invalid={true}
          />
          <Field.Error
            errors={[
              { message: "Минимум 8 символов" },
              { message: "Должен содержать цифру" },
            ]}
          />
        </Field.Content>
      </Field>
    </div>
  ),
};

// ─────────────────────────────────────────────
// Field.Content — отдельная история
// ─────────────────────────────────────────────

export const FieldContentStory: Story = {
  name: "Field.Content",
  parameters: {
    docs: {
      description: {
        story:
          "`Field.Content` — обёртка для инпута и вспомогательных элементов (`flex-col gap-0.5`). " +
          "Автоматически прокидывает `id` из контекста `Field` на первый дочерний элемент " +
          "(чтобы `Field.Label` мог привязаться через `htmlFor`). " +
          "Внутри размещайте: инпут, `Field.Description`, `Field.Error`.",
      },
    },
  },
  render: () => (
    <Field>
      <Field.Label>Поиск</Field.Label>
      <Field.Content>
        <Field.Description>Введите название технологии</Field.Description>
        <input
          className="flex h-[46px] w-full min-w-0 rounded-lg border border-input bg-background px-4 py-[13px] text-sm text-foreground outline-none"
          placeholder="React, TypeScript..."
        />
        <Field.Error />
      </Field.Content>
    </Field>
  ),
};

// ─────────────────────────────────────────────
// Field.Group + Field.Set — отдельная история
// ─────────────────────────────────────────────

export const FieldGroupStory: Story = {
  name: "Field.Group",
  parameters: {
    docs: {
      description: {
        story:
          "`Field.Group` — контейнер для вертикального стека нескольких полей (`flex-col gap-5`). " +
          "Используйте, когда нужно сгруппировать несколько `Field` в одну форму.\n\n" +
          "`Field.Set` — семантический `<fieldset>` для связанных полей (чекбоксы, радиокнопки) " +
          "с общим `Field.Legend`.",
      },
    },
  },
  render: () => (
    <Field.Group style={{ width: 400 }}>
      <Field>
        <Field.Label>Имя</Field.Label>
        <Field.Content>
          <input
            className="flex h-[46px] w-full min-w-0 rounded-lg border border-input bg-background px-4 py-[13px] text-sm text-foreground outline-none"
            placeholder="Иван"
          />
        </Field.Content>
      </Field>
      <Field>
        <Field.Label>Email</Field.Label>
        <Field.Content>
          <input
            className="flex h-[46px] w-full min-w-0 rounded-lg border border-input bg-background px-4 py-[13px] text-sm text-foreground outline-none"
            placeholder="example@mail.com"
          />
        </Field.Content>
      </Field>
      <Field>
        <Field.Label>Пароль</Field.Label>
        <Field.Content>
          <Field.Description>Минимум 8 символов</Field.Description>
          <input
            type="password"
            className="flex h-[46px] w-full min-w-0 rounded-lg border border-input bg-background px-4 py-[13px] text-sm text-foreground outline-none"
            placeholder="••••••••"
          />
          <Field.Error />
        </Field.Content>
      </Field>
    </Field.Group>
  ),
};
