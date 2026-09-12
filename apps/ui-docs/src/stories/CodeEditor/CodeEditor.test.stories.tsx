import type { Meta, StoryObj } from "@storybook/react";
import { composeStory } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import codeEditorMeta, { Languages } from "./CodeEditor.stories";

const LanguagesStory = composeStory(Languages, codeEditorMeta);

const meta = {
  title: "Tests/CodeEditor/Language selection",
  component: LanguagesStory,
  tags: ["!autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof LanguagesStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AnnouncesAndChangesTheSelectedLanguage: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const typescript = canvas.getByRole("button", { name: "typescript" });
    const python = canvas.getByRole("button", { name: "python" });

    await expect(typescript).toHaveAttribute("aria-pressed", "true");
    await expect(python).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(python);

    await expect(typescript).toHaveAttribute("aria-pressed", "false");
    await expect(python).toHaveAttribute("aria-pressed", "true");
  },
};
