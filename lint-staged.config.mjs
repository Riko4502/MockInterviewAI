export default {
  "**/*.{js,jsx,ts,tsx,json,css,mjs}": [
    "npx biome check --write --no-errors-on-unmatched",
  ],
  "apps/realtime/**/*.go": () => "pnpm run lint:realtime",
};
