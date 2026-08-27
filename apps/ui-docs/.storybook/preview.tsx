import * as React from "react";
import "@packages/ui/globals.css";
import type { Preview } from "storybook-react-rsbuild";

if (typeof window !== "undefined") {
  (window as unknown as { React: typeof React }).React = React;
}
if (typeof globalThis !== "undefined") {
  (globalThis as unknown as { React: typeof React }).React = React;
}

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
  },
};

export default preview;
