import { paths } from "@/shared/config";
import type { ReadinessStep } from "./types";

type StepAction =
  | { kind: "media" }
  | { kind: "link"; href: string }
  | { kind: "unavailable" };

// TODO: Добавить сценарий подтверждения email после появления API-контракта.
// EMAIL_PROVIDED означает наличие email, а не его подтверждение.
export const READINESS_ACTIONS = {
  EMAIL_PROVIDED: { kind: "unavailable" },
  MEDIA_CONFIGURED: { kind: "media" },
  // TODO: Подключить запрос link-token, показ QR-кода/deep-link и обновление readiness после подтверждения через бота.
  TELEGRAM_LINKED: { kind: "unavailable" },
  // TODO: Добавить форму создания анкеты и вызов POST /api/v1/showcase.
  SHOWCASE_CREATED: { kind: "unavailable" },
  FIRST_MOCK_COMPLETED: { kind: "link", href: paths.sandbox },
} as const satisfies Record<ReadinessStep["key"], StepAction>;
