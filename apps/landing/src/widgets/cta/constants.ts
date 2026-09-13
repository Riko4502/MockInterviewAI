/**
 * Константы для виджета CTA (FR-040, SC-011, T024).
 * Не содержат вызовов t(), React или hooks. Ключи локализации резолвятся
 * внутри компонентов через useTranslation("landing").
 */

export const CTA_BENEFITS = [
  "cta.benefit1",
  "cta.benefit2",
  "cta.benefit3",
] as const;

export type CtaBenefitKey = (typeof CTA_BENEFITS)[number];
