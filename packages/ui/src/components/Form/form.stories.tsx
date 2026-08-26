import type { Meta, StoryObj } from "@storybook/react-vite";
import { Field } from "./form";

const meta = {
  title: "Components/Form/Field",
  component: Field,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: "select",
      options: ["vertical", "horizontal", "responsive"],
    },
  },
} as Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof Field>;

export const Vertical: Story = {
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

export const Valid: Story = {
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

export const Horizontal: Story = {
  args: {
    orientation: "horizontal",
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

export const WithDescription: Story = {
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
