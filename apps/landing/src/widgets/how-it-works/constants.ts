/**
 * Константы и конфигурации для виджета How It Works (FR-040, SC-011).
 * Не содержат вызовов t(), React или hooks. Все ключи локализации резолвятся
 * внутри компонентов через useTranslation("landing").
 */

export const GRADE_DEFINITIONS = [
  { id: "junior", labelKey: "howItWorks.gradeJunior", level: "L3" },
  { id: "middle", labelKey: "howItWorks.gradeMiddle", level: "L4" },
  { id: "senior", labelKey: "howItWorks.gradeSenior", level: "L5" },
  { id: "lead", labelKey: "howItWorks.gradeLead", level: "L6" },
] as const;

export type GradeId = (typeof GRADE_DEFINITIONS)[number]["id"];

export const TRACK_DEFINITIONS = [
  {
    id: "track-frontend",
    titleKey: "howItWorks.track1Title",
    descriptionKey: "howItWorks.track1Desc",
    duration: "60 min",
    focusTags: ["React 19", "Next.js", "TypeScript", "Web Vitals"],
    tasksByGrade: {
      junior: "howItWorks.taskFrontendJunior",
      middle: "howItWorks.taskFrontendMiddle",
      senior: "howItWorks.taskFrontendSenior",
      lead: "howItWorks.taskFrontendLead",
    },
    accentColor:
      "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400",
    gradient: "from-violet-600 to-indigo-600",
  },
  {
    id: "track-backend",
    titleKey: "howItWorks.track2Title",
    descriptionKey: "howItWorks.track2Desc",
    duration: "60 min",
    focusTags: ["Golang", "PostgreSQL", "Redis", "gRPC"],
    tasksByGrade: {
      junior: "howItWorks.taskBackendJunior",
      middle: "howItWorks.taskBackendMiddle",
      senior: "howItWorks.taskBackendSenior",
      lead: "howItWorks.taskBackendLead",
    },
    accentColor: "border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    gradient: "from-sky-600 to-blue-600",
  },
  {
    id: "track-system-design",
    titleKey: "howItWorks.track3Title",
    descriptionKey: "howItWorks.track3Desc",
    duration: "45 min",
    focusTags: ["High Load", "Kafka", "Sharding", "WebSockets"],
    tasksByGrade: {
      junior: "howItWorks.taskSysDesignJunior",
      middle: "howItWorks.taskSysDesignMiddle",
      senior: "howItWorks.taskSysDesignSenior",
      lead: "howItWorks.taskSysDesignLead",
    },
    accentColor:
      "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    gradient: "from-amber-600 to-orange-600",
  },
  {
    id: "track-algorithms",
    titleKey: "howItWorks.track4Title",
    descriptionKey: "howItWorks.track4Desc",
    duration: "45 min",
    focusTags: ["Dynamic Programming", "Graphs", "Trees", "Big-O O(1)"],
    tasksByGrade: {
      junior: "howItWorks.taskAlgoJunior",
      middle: "howItWorks.taskAlgoMiddle",
      senior: "howItWorks.taskAlgoSenior",
      lead: "howItWorks.taskAlgoLead",
    },
    accentColor:
      "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    gradient: "from-emerald-600 to-teal-600",
  },
] as const;

export type TrackDefinition = (typeof TRACK_DEFINITIONS)[number];

export interface VerdictConfig {
  readonly text: string;
  readonly variant: "statusSuccess" | "statusInfo" | "waiting";
  readonly percentile: string;
}

export interface VerdictThreshold {
  readonly minScore: number;
  readonly verdict: VerdictConfig;
}

export const VERDICT_THRESHOLDS: readonly VerdictThreshold[] = [
  {
    minScore: 90,
    verdict: {
      text: "STRONG HIRE",
      variant: "statusSuccess",
      percentile: "Top 2%",
    },
  },
  {
    minScore: 75,
    verdict: {
      text: "HIRE",
      variant: "statusInfo",
      percentile: "Top 15%",
    },
  },
] as const;

export const DEFAULT_VERDICT: VerdictConfig = {
  text: "LEVELED UP",
  variant: "waiting",
  percentile: "Top 35%",
} as const;

export function getVerdict(score: number): VerdictConfig {
  for (const threshold of VERDICT_THRESHOLDS) {
    if (score >= threshold.minScore) {
      return threshold.verdict;
    }
  }
  return DEFAULT_VERDICT;
}

export interface SimulationTestStep {
  readonly id: string;
  readonly step: number;
  readonly label: string;
  readonly isHighlighted?: boolean;
}

export const SIMULATION_TEST_STEPS: readonly SimulationTestStep[] = [
  {
    id: "step-cache-init",
    step: 1,
    label: "test_cache_initialization (2ms)",
  },
  {
    id: "step-lru-eviction",
    step: 2,
    label: "test_lru_eviction_policy (5ms)",
  },
  {
    id: "step-concurrent-writes",
    step: 3,
    label: "test_concurrent_writes (9ms)",
  },
  {
    id: "step-memory-benchmark",
    step: 4,
    label: "test_memory_benchmark < 2.4MB (12ms)",
    isHighlighted: true,
  },
] as const;

export const AI_INTERVIEW_CHECKLIST = [
  "howItWorks.step2Check1",
  "howItWorks.step2Check2",
  "howItWorks.step2Check3",
] as const;
