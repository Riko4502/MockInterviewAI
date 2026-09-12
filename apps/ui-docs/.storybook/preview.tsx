import "../src/globals.css";
import { UIProvider } from "@packages/ui";
import { themes } from "storybook/theming";
import type { Preview } from "storybook-react-rsbuild";

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
