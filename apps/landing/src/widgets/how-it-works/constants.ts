/**
 * Константы и конфигурации для виджета How It Works (FR-040, SC-011).
 * Не содержат вызовов t(), React или hooks. Все ключи локализации резолвятся
 * внутри компонентов через useTranslation("landing").
 */

export const TRACK_DEFINITIONS = [
  {
    id: "track-frontend",
    titleKey: "howItWorks.track1Title",
    descriptionKey: "howItWorks.track1Desc",
    duration: "60 min",
  },
  {
    id: "track-backend",
    titleKey: "howItWorks.track2Title",
    descriptionKey: "howItWorks.track2Desc",
    duration: "45 min",
  },
  {
    id: "track-system-design",
    titleKey: "howItWorks.track3Title",
    descriptionKey: "howItWorks.track3Desc",
    duration: "60 min",
  },
  {
    id: "track-algorithms",
    titleKey: "howItWorks.track4Title",
    descriptionKey: "howItWorks.track4Desc",
    duration: "45 min",
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
