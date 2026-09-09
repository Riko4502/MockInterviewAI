/**
 * Статические конфигурации и данные для виджета Hero (FR-040, SC-011, T023).
 * Не содержат вызовов t(), React или hooks. Ключи локализации резолвятся
 * внутри компонентов через useTranslation("landing").
 */

export interface HeroMetricItem {
  readonly id: string;
  readonly valueKey: string;
  readonly labelKey: string;
  readonly valueClassName: string;
}

export const HERO_METRICS = [
  {
    id: "metric-1",
    valueKey: "hero.metric1Value",
    labelKey: "hero.metric1Label",
    valueClassName: "text-2xl sm:text-3xl font-extrabold text-white font-mono",
  },
  {
    id: "metric-2",
    valueKey: "hero.metric2Value",
    labelKey: "hero.metric2Label",
    valueClassName:
      "text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono",
  },
  {
    id: "metric-3",
    valueKey: "hero.metric3Value",
    labelKey: "hero.metric3Label",
    valueClassName:
      "text-2xl sm:text-3xl font-extrabold text-violet-400 font-mono",
  },
  {
    id: "metric-4",
    valueKey: "hero.metric4Value",
    labelKey: "hero.metric4Label",
    valueClassName:
      "text-2xl sm:text-3xl font-extrabold text-indigo-300 font-mono",
  },
] as const;

export type HeroMetric = (typeof HERO_METRICS)[number];

export interface MockupTabItem {
  readonly id: "solution" | "test";
  readonly filename: string;
  readonly badge?: string;
}

export const MOCKUP_TABS: readonly MockupTabItem[] = [
  {
    id: "solution",
    filename: "solution.ts",
    badge: "TS",
  },
  {
    id: "test",
    filename: "test.spec.ts",
  },
] as const;

export type MockupTab = (typeof MOCKUP_TABS)[number]["id"];

export interface CodeToken {
  readonly text: string;
  readonly className?: string;
}

export interface SolutionCodeLine {
  readonly line: number;
  readonly indentClass?: string;
  readonly rowClassName?: string;
  readonly lineNumClassName?: string;
  readonly contentClassName?: string;
  readonly tokens: readonly CodeToken[];
  readonly hasCursor?: boolean;
}

export const SOLUTION_CODE_LINES: readonly SolutionCodeLine[] = [
  {
    line: 1,
    tokens: [
      {
        text: "export async function",
        className: "text-violet-400 font-semibold",
      },
      { text: " " },
      { text: "evaluateStream", className: "text-sky-300" },
      { text: "(" },
    ],
  },
  {
    line: 2,
    indentClass: "pl-4",
    tokens: [
      { text: "stream", className: "text-slate-400" },
      { text: ": " },
      { text: "AsyncIterable", className: "text-amber-300" },
      { text: "<" },
      { text: "Token", className: "text-emerald-300" },
      { text: ">" },
    ],
  },
  {
    line: 3,
    tokens: [{ text: ") {" }],
  },
  {
    line: 4,
    indentClass: "pl-4",
    tokens: [
      { text: "const", className: "text-violet-400" },
      { text: " metrics = " },
      { text: "new", className: "text-violet-400" },
      { text: " " },
      { text: "PerformanceTracker", className: "text-amber-300" },
      { text: "();" },
    ],
  },
  {
    line: 5,
    indentClass: "pl-4",
    tokens: [
      { text: "for await", className: "text-violet-400" },
      { text: " (" },
      { text: "const", className: "text-violet-400" },
      { text: " token " },
      { text: "of", className: "text-violet-400" },
      { text: " stream) {" },
    ],
  },
  {
    line: 6,
    indentClass: "pl-8",
    contentClassName: "text-sky-300",
    tokens: [{ text: "metrics.recordLatency(token.timestamp);" }],
  },
  {
    line: 7,
    indentClass: "pl-8",
    rowClassName: "bg-violet-500/10 -mx-2 px-2 rounded",
    lineNumClassName: "text-violet-400",
    contentClassName: "text-emerald-400",
    hasCursor: true,
    tokens: [{ text: "yield evaluatePrompt(token); " }],
  },
  {
    line: 8,
    indentClass: "pl-4",
    tokens: [{ text: "}" }],
  },
  {
    line: 9,
    tokens: [{ text: "}" }],
  },
] as const;
