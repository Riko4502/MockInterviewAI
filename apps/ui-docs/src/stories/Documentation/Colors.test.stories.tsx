import type { Meta, StoryObj } from "@storybook/react";
import { composeStory } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import colorsMeta, { Default } from "./Colors.stories";

const ColorsStory = composeStory(Default, colorsMeta);

const meta = {
  title: "Tests/Documentation/Color tokens",
  component: ColorsStory,
  tags: ["!autodocs"],
} satisfies Meta<typeof ColorsStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CopiesTheExactCssVariableAndResetsItsStatus: Story = {
  play: async ({ canvasElement }) => {
    const writeText = fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const canvas = within(canvasElement);
    const copyBackground = canvas.getByRole("button", {
      name: /--background.*Копия/,
    });

    await userEvent.click(copyBackground);

    await expect(writeText).toHaveBeenCalledOnce();
    await expect(writeText).toHaveBeenCalledWith("var(--background)");
    await expect(copyBackground).toHaveTextContent("(Скопировано)");

    await new Promise((resolve) => setTimeout(resolve, 2100));
    await expect(copyBackground).toHaveTextContent("(Копия)");
  },
};
