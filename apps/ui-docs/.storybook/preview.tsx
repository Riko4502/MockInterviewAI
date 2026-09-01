import "../src/globals.css";
import { themes } from "storybook/theming";
import type { Preview } from "storybook-react-rsbuild";

const preview: Preview = {
  parameters: {
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
