import type { StorybookConfig } from "@storybook/react-vite";

import { dirname } from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";

function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
  addons: [
    getAbsolutePath("@chromatic-com/storybook"),
    getAbsolutePath("@storybook/addon-vitest"),
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@storybook/addon-docs"),
    getAbsolutePath("@storybook/addon-onboarding"),
  ],
  framework: getAbsolutePath("@storybook/react-vite"),
  async viteFinal(config) {
    config.plugins = config.plugins || [];
    config.plugins.push(tailwindcss());
    config.resolve = config.resolve || {};
    config.resolve.tsconfigPaths = true;
    return config;
  },
};
export default config;
