import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

function ThemeVariantProbes() {
  return (
    <div>
      <div data-testid="light" className="size-4 bg-white dark:bg-black" />
      <div className="dark">
        <div
          data-testid="class-descendant"
          className="size-4 bg-white dark:bg-black"
        />
      </div>
      <div data-theme="dark">
        <div
          data-testid="attribute-descendant"
          className="size-4 bg-white dark:bg-black"
        />
      </div>
      <div
        data-testid="attribute-self"
        data-theme="dark"
        className="size-4 bg-white dark:bg-black"
      />
    </div>
  );
}

const meta = {
  title: "Tests/Documentation/Dark theme variant",
  component: ThemeVariantProbes,
  tags: ["!autodocs"],
} satisfies Meta<typeof ThemeVariantProbes>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SupportsClassAndDataAttributeScopes: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      getComputedStyle(canvas.getByTestId("light")).backgroundColor,
    ).toBe("rgb(255, 255, 255)");

    for (const testId of [
      "class-descendant",
      "attribute-descendant",
      "attribute-self",
    ]) {
      await expect(
        getComputedStyle(canvas.getByTestId(testId)).backgroundColor,
      ).toBe("rgb(0, 0, 0)");
    }
  },
};
