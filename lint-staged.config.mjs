export default {
  "**/*.{js,jsx,ts,tsx,json,css,mjs,astro}": [
    "biome check --write --no-errors-on-unmatched",
  ],
  "apps/realtime/**/*.go": () => "pnpm run lint:realtime",
};
