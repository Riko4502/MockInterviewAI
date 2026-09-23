import "../src/globals.css";
import { UIProvider } from "@packages/ui";
import { themes } from "storybook/theming";
import type { Preview } from "storybook-react-rsbuild";

if (typeof window !== "undefined" && !window.MonacoEnvironment) {
  window.MonacoEnvironment = {
    getWorker() {
      return new Worker(
        URL.createObjectURL(
          new Blob(
            [
              `/* dummy monaco worker */
               self.onmessage = function () {};
              `,
            ],
            { type: "application/javascript" },
          ),
        ),
      );
    },
  };
}

const preview: Preview = {
  decorators: [
    (Story) => (
      <UIProvider>
        <Story />
      </UIProvider>
    ),
  ],
  parameters: {
    options: {
      storySort: {
        order: [
          "Documentation",
          ["Introduction", "Colors & Tokens", "*"],
          "Components",
          "UI",
          "*",
        ],
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: "todo",
    },
    docs: {
      theme: themes.dark,
    },
  },
};

export default preview;
