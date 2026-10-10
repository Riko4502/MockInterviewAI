// Входной контракт метода sendTemplate
// Описывает, что принимает MailService на вход. Благодаря дженерику SendTemplateOptions<K>, если ты выбрал template: 'reset-password', в props TypeScript разрешит передать только поля для сброса пароля.

import type { Locale } from "@packages/i18n";
import type {
  EmailTemplateKey,
  EmailTemplatePropsMap,
} from "./template-map.interface";

/**
 * Параметры отправки письма по шаблону.
 * Благодаря дженерику K компилятор строго проверяет соответствие props выбранному template.
 */
export interface SendTemplateOptions<
  K extends EmailTemplateKey = EmailTemplateKey,
> {
  /** Email адрес получателя */
  to: string;

  /** Идентификатор шаблона письма */
  template: K;

  /** Входные данные, строго типизированные для выбранного шаблона */
  props: EmailTemplatePropsMap[K];

  /** Языковая локаль письма (по умолчанию 'ru') */
  locale?: Locale;

  /** Опциональное переопределение темы письма (если не указано, берётся из i18n) */
  subject?: string;
}
