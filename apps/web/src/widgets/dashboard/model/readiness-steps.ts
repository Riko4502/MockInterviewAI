import { paths } from "@/shared/config";
import type { ReadinessStep } from "./types";

type StepAction =
  | { kind: "media" }
  | { kind: "link"; href: string }
  | { kind: "unavailable" };

export const READINESS_ACTIONS = {
  EMAIL_PROVIDED: { kind: "link", href: paths.profile },
  MEDIA_CONFIGURED: { kind: "media" },
  TELEGRAM_LINKED: { kind: "link", href: paths.profile },
  SHOWCASE_CREATED: { kind: "link", href: paths.partnersNew },
  FIRST_MOCK_COMPLETED: { kind: "link", href: paths.sandbox },
} as const satisfies Record<ReadinessStep["key"], StepAction>;
