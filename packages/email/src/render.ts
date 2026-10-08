import { getMessages, type Locale } from "@packages/i18n";
import { render } from "@react-email/render";
import type { ReactElement } from "react";
import * as React from "react";
import {
  type InterviewReminderProps,
  InterviewReminderTemplate,
  type InterviewScheduledProps,
  InterviewScheduledTemplate,
  type ResetPasswordProps,
  ResetPasswordTemplate,
  type SecurityAlertProps,
  SecurityAlertTemplate,
  type VerifyEmailProps,
  VerifyEmailTemplate,
} from "./templates";

/**
 * Допустимые ключи шаблонов писем платформы MockInterviewAI.
 */
export type EmailTemplateKey =
  | "verify-email"
  | "reset-password"
  | "interview-scheduled"
  | "interview-reminder"
  | "security-alert";

/**
 * Входные пропсы шаблонов (без служебных полей lang и texts, управляемых пакетом).
 */
export interface EmailTemplatePropsMap {
  "verify-email": Omit<VerifyEmailProps, "lang" | "texts">;
  "reset-password": Omit<ResetPasswordProps, "lang" | "texts">;
  "interview-scheduled": Omit<InterviewScheduledProps, "lang" | "texts">;
  "interview-reminder": Omit<InterviewReminderProps, "lang" | "texts">;
  "security-alert": Omit<SecurityAlertProps, "lang" | "texts">;
}

/**
 * Результат рендера письма.
 */
export interface RenderedEmailResult {
  html: string;
  text: string;
  subject: string;
}

/**
 * Рендерит React Email компонент одновременно в HTML и чистую текстовую (plain-text) версию.
 */
export async function renderEmail(
  element: ReactElement,
): Promise<{ html: string; text: string }> {
  const html = await render(element);
  const text = await render(element, { plainText: true });
  return { html, text };
}

/**
 * Высокоуровневая функция рендера шаблона по ключу.
 * Инкапсулирует выбор React-компонента, сборку пропсов, локализацию i18n и получение темы письма по умолчанию.
 */
export async function renderTemplate<K extends EmailTemplateKey>(
  template: K,
  props: EmailTemplatePropsMap[K],
  locale: Locale = "ru",
): Promise<RenderedEmailResult> {
  const emailDict = getMessages(locale).email;

  let element: ReactElement;
  let subject: string;

  switch (template) {
    case "reset-password": {
      const p = props as EmailTemplatePropsMap["reset-password"];
      element = React.createElement(ResetPasswordTemplate, {
        ...p,
        lang: locale,
        texts: emailDict.resetPassword,
      });
      subject = emailDict.resetPassword.subject;
      break;
    }
    case "verify-email": {
      const p = props as EmailTemplatePropsMap["verify-email"];
      element = React.createElement(VerifyEmailTemplate, {
        ...p,
        lang: locale,
        texts: emailDict.verifyEmail,
      });
      subject = emailDict.verifyEmail.subject;
      break;
    }
    case "interview-scheduled": {
      const p = props as EmailTemplatePropsMap["interview-scheduled"];
      element = React.createElement(InterviewScheduledTemplate, {
        ...p,
        lang: locale,
        texts: emailDict.interviewScheduled,
      });
      subject = emailDict.interviewScheduled.subject.replace(
        "{scheduledTime}",
        p.scheduledTime,
      );
      break;
    }
    case "interview-reminder": {
      const p = props as EmailTemplatePropsMap["interview-reminder"];
      element = React.createElement(InterviewReminderTemplate, {
        ...p,
        lang: locale,
        texts: emailDict.interviewReminder,
      });
      subject = emailDict.interviewReminder.subject.replace(
        "{minutesUntilStart}",
        String(p.minutesUntilStart),
      );
      break;
    }
    case "security-alert": {
      const p = props as EmailTemplatePropsMap["security-alert"];
      element = React.createElement(SecurityAlertTemplate, {
        ...p,
        timestamp: p.timestamp ?? new Date().toISOString(),
        lang: locale,
        texts: emailDict.securityAlert,
      });
      subject = emailDict.securityAlert.subject.replace(
        "{title}",
        emailDict.securityAlert.title,
      );
      break;
    }
    default: {
      const exhaustiveCheck: never = template;
      throw new Error(`Unsupported email template: ${exhaustiveCheck}`);
    }
  }

  const { html, text } = await renderEmail(element);
  return { html, text, subject };
}
