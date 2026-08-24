import type { Meta, StoryObj } from '@storybook/react-vite';
import { Field } from './field';

const meta = {
  title: 'UI/Field',
  component: Field,
  tags: ['autodocs'],
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Email',
    placeholder: 'you@example.com',
  },
};

export const WithError: Story = {
  args: {
    label: 'Email',
    placeholder: 'you@example.com',
    error: 'Введите корректный email',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Email',
    placeholder: 'you@example.com',
    disabled: true,
  },
};