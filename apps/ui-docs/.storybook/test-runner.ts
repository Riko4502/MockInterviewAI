import type { TestRunnerConfig } from "@storybook/test-runner";

const config: TestRunnerConfig = {
  async postVisit(page, story) {
    if (story.id === "components-resizable--default") {
      const handle = page.locator("[role='separator']");
      await handle.waitFor();
      const leftPanel = page.locator("[data-slot='resizable-panel']").first();
      const initialStyle = await leftPanel.getAttribute("style");

      const box = await handle.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(
          box.x + box.width / 2 + 80,
          box.y + box.height / 2,
        );
        await page.mouse.up();
      }

      const updatedStyle = await leftPanel.getAttribute("style");
      if (updatedStyle === initialStyle) {
        throw new Error(
          "Resizable Default: Expected left panel style to change after drag",
        );
      }
    }

    if (story.id === "components-resizable--vertical") {
      const handle = page.locator("[role='separator']");
      await handle.waitFor();
      const topPanel = page.locator("[data-slot='resizable-panel']").first();
      const initialStyle = await topPanel.getAttribute("style");

      const box = await handle.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(
          box.x + box.width / 2,
          box.y + box.height / 2 + 60,
        );
        await page.mouse.up();
      }

      const updatedStyle = await topPanel.getAttribute("style");
      if (updatedStyle === initialStyle) {
        throw new Error(
          "Resizable Vertical: Expected top panel style to change after drag",
        );
      }
    }

    if (story.id === "components-resizable--keyboard-resize") {
      const handle = page.locator("[role='separator']");
      await handle.waitFor();
      const leftPanel = page.locator("[data-slot='resizable-panel']").first();
      const initialStyle = await leftPanel.getAttribute("style");

      await handle.focus();
      await page.keyboard.press("ArrowRight");

      const updatedStyle = await leftPanel.getAttribute("style");
      if (updatedStyle === initialStyle) {
        throw new Error(
          "Resizable KeyboardResize: Expected left panel style to change after ArrowRight",
        );
      }
    }
  },
};

export default config;
