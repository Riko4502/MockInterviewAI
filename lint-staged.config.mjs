export default {
  'apps/web/**/*.{js,jsx,ts,tsx,json,css,mjs}': [
    'pnpm --filter web exec biome check --write --no-errors-on-unmatched',
  ],
  'apps/api/**/*.{js,ts,json}': [
    'pnpm --filter api exec biome check --write --no-errors-on-unmatched',
  ],
}