import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RsbuildPlugin } from "@rsbuild/core";
import type { StorybookConfig } from "storybook-react-rsbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const provideReactPlugin: RsbuildPlugin = {
  name: "provide-react",
  setup(api) {
    api.modifyRspackConfig((_rspackConfig, { appendPlugins, rspack }) => {
      appendPlugins(
        new rspack.ProvidePlugin({
          React: "react",
        }),
      );
    });
  },
};

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
  addons: [
    "@chromatic-com/storybook",
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-onboarding",
  ],
  framework: "storybook-react-rsbuild",
  rsbuildFinal(config) {
    config.plugins = config.plugins || [];
    config.plugins.push(provideReactPlugin);
    config.source = config.source || {};
    config.source.alias = {
      ...(config.source.alias as Record<string, string>),
      "@packages/utils": path.resolve(__dirname, "../../../packages/utils"),
    };
    return config;
  },
};

export default config;
