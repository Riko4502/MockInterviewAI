/**
 * Exact Design System Tokens for MockInterviewAI
 * All colors match the existing OKLCH palette defined in the project.
 */
export const colors = {
  background: "oklch(0.155 0.002 286.152)",
  foreground: "oklch(1 0 0)",
  card: {
    DEFAULT: "oklch(0.184 0.008 285.577)",
    foreground: "oklch(1 0 0)",
  },
  popover: {
    DEFAULT: "oklch(0.184 0.008 285.577)",
    foreground: "oklch(1 0 0)",
  },
  primary: {
    DEFAULT: "oklch(0.596 0.207 290.953)",
    foreground: "oklch(1 0 0)",
  },
  secondary: {
    DEFAULT: "oklch(0.2729 0.0184 285.12)",
    foreground: "oklch(1 0 0)",
  },
  muted: {
    DEFAULT: "oklch(0.225 0.012 285.432)",
    foreground: "oklch(0.691 0.006 247.906)",
  },
  accent: {
    DEFAULT: "oklch(0.225 0.012 285.432)",
    foreground: "oklch(1 0 0)",
  },
  destructive: {
    DEFAULT: "oklch(0.704 0.191 22.216)",
  },
  border: "oklch(1 0 0 / 10%)",
  input: "oklch(1 0 0 / 15%)",
  ring: "oklch(0.596 0.207 290.953)",
  chart: {
    1: "oklch(0.596 0.207 290.953)",
    2: "oklch(0.637 0.139 145.572)",
    3: "oklch(0.696 0.17 162.48)",
    4: "oklch(0.627 0.265 303.9)",
    5: "oklch(0.645 0.246 16.439)",
  },
  sidebar: {
    DEFAULT: "oklch(0.155 0.002 286.152)",
    foreground: "oklch(1 0 0)",
    primary: "oklch(0.596 0.207 290.953)",
    primaryForeground: "oklch(1 0 0)",
    accent: "oklch(0.225 0.012 285.432)",
    accentForeground: "oklch(1 0 0)",
    border: "oklch(1 0 0 / 10%)",
    ring: "oklch(0.596 0.207 290.953)",
  },
  success: {
    DEFAULT: "oklch(0.439 0.264 165.214)",
    foreground: "oklch(1 0 0)",
  },
} as const;

export const radius = {
  base: "0.75rem",
  xs: "calc(0.75rem * 0.4)",
  sm: "calc(0.75rem * 0.6)",
  md: "calc(0.75rem * 0.8)",
  lg: "0.75rem",
  xl: "calc(0.75rem * 1.4)",
  "2xl": "calc(0.75rem * 1.8)",
  "3xl": "calc(0.75rem * 2.2)",
  "4xl": "calc(0.75rem * 2.6)",
} as const;

export type ThemeColors = typeof colors;
export type ThemeRadius = typeof radius;
