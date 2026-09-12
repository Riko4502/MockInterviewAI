import type { Meta, StoryObj } from "@storybook/react";
import { composeStory } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import iconsMeta, { Gallery } from "./icons.stories";

const IconsStory = composeStory(Gallery, iconsMeta);

const meta = {
  title: "Tests/Icons/Gallery",
  component: IconsStory,
  tags: ["!autodocs"],
} satisfies Meta<typeof IconsStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UsesThemeTokensAndSupportsCopyAndEmptySearch: Story = {
  play: async ({ canvasElement }) => {
    const writeText = fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const canvas = within(canvasElement);
    const codeIcon = canvas.getByRole("button", { name: "Code" });

    await expect(codeIcon).toHaveClass("border-border", "bg-card");
    await expect(codeIcon).not.toHaveClass("border-neutral-200", "bg-white");

    await userEvent.click(codeIcon);

    await expect(writeText).toHaveBeenCalledWith('<CodeIcon size="md" />');
    await expect(codeIcon).toHaveClass("border-success", "text-success");
    await expect(codeIcon).toHaveTextContent("Скопировано!");

    const search = canvas.getByPlaceholderText("Поиск по названию...");
    await userEvent.clear(search);
    await userEvent.type(search, "definitely-not-an-icon");

    await expect(
      canvas.getByText(/Иконки по запросу.*definitely-not-an-icon.*не найдены/),
    ).toBeInTheDocument();
  },
};
