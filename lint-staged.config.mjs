export default {
  'apps/web/**/*.{js,jsx,ts,tsx,json,css,mjs}': [
    'pnpm --filter web exec biome check --write --no-errors-on-unmatched',
  ],
}