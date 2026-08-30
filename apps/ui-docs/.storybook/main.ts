import type { RsbuildPlugin } from "@rsbuild/core";
import type { StorybookConfig } from "storybook-react-rsbuild";

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
    return config;
  },
};

export default config;
