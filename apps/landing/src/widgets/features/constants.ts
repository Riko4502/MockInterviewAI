/**
 * Константы для виджета Features (FR-040, SC-011, T024).
 * Не содержат вызовов t(), React или hooks.
 */

export interface SandboxRegion {
  readonly id: string;
  readonly name: string;
  readonly ping: string;
  readonly status: string;
}

export const SANDBOX_REGIONS: readonly SandboxRegion[] = [
  { id: "eu", name: "EU-Central", ping: "14ms", status: "Optimal" },
  { id: "us", name: "US-East", ping: "18ms", status: "Optimal" },
  { id: "ap", name: "AP-East", ping: "32ms", status: "Active" },
] as const;
