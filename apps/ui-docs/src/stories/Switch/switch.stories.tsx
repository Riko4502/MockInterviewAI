import { Switch } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "UI/Switch",
  component: Switch,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { "aria-label": "Переключатель" } };
export const Checked: Story = {
  args: { defaultChecked: true, "aria-label": "Переключатель" },
};
export const Disabled: Story = {
  args: { disabled: true, "aria-label": "Переключатель" },
};
export const DisabledChecked: Story = {
  args: { disabled: true, defaultChecked: true, "aria-label": "Переключатель" },
};
