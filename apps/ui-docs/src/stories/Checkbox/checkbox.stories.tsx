import { Checkbox } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "UI/Checkbox",
  component: Checkbox,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { "aria-label": "Чекбокс" },
};

export const Checked: Story = {
  args: { defaultChecked: true, "aria-label": "Чекбокс" },
};
export const Indeterminate: Story = {
  args: {
    checked: "indeterminate",
    "aria-label": "Чекбокс",
    onCheckedChange: () => {},
  },
};

export const Disabled: Story = {
  args: { disabled: true, "aria-label": "Чекбокс" },
};

export const DisabledChecked: Story = {
  args: { disabled: true, defaultChecked: true, "aria-label": "Чекбокс" },
};
