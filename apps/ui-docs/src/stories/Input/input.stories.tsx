import type { Meta, StoryObj } from '@storybook/react';
import { Input } from '@packages/ui';

const meta = {
  title: 'UI/Input',
  component: Input,
  parameters: {
    layout: "centered",
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number'],
    },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    type: 'text',
    placeholder: 'Введите текст',
  },
};

export const Disabled: Story = {
  args: {
    type: 'text',
    placeholder: 'Недоступно для ввода',
    disabled: true,
  },
};

export const Invalid: Story = {
  args: {
    type: 'text',
    placeholder: 'Некорректное значение',
    'aria-invalid': true,
  },
};
