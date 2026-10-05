import { getMessages, type Locale } from "@packages/i18n";
import { Heading, Section, Text } from "@react-email/components";

import { Button } from "../components/button";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
import { Layout } from "../components/layout";

/**
 * Локализованные тексты для шаблона запланированного интервью.
 */
export interface InterviewScheduledTexts {
  previewText: string;
  title: string;
  greeting: string;
  description: string;
  partnerLabel: string;
  timeLabel: string;
  topicLabel: string;
  roleLabel: string;
  buttonText: string;
  preparationTip: string;
  rescheduleNotice: string;
}

/**
 * Пропсы шаблона запланированного интервью.
 */
export interface InterviewScheduledProps {
  /** Имя текущего пользователя (получателя письма) */
  username?: string;
  /** Имя партнера по собеседованию */
  partnerName: string;
  /** Человекочитаемая дата и время интервью */
  scheduledTime: string;
  /** Прямая ссылка на комнату видеовстречи */
  roomUrl: string;
  /** Роль текущего пользователя (например: 'Кандидат' или 'Интервьюер') */
  role?: string;
  /** Направление или тема собеседования (например: 'Frontend: React & TypeScript') */
  topic?: string;
  /** Локаль письма */
  lang?: Locale;
  /** Опциональное переопределение текстов */
  texts?: Partial<InterviewScheduledTexts>;
}

/**
 * Шаблон письма-подтверждения запланированного тренировочного интервью.
 */
export const InterviewScheduledTemplate = ({
  username,
  partnerName,
  scheduledTime,
  roomUrl,
  role,
  topic,
  lang = "ru",
  texts: userTexts,
}: InterviewScheduledProps) => {
  const dict = getMessages(lang).email.interviewScheduled;
  const texts: InterviewScheduledTexts = { ...dict, ...userTexts };

  const preview = texts.previewText.replace("{scheduledTime}", scheduledTime);
  const title = texts.title;
  const greeting = username
    ? texts.greeting.replace("{username}", username)
    : texts.greeting.replace(", {username}", "").replace(" {username}", "");
  const description = texts.description;
  const partnerLabel = texts.partnerLabel;
  const timeLabel = texts.timeLabel;
  const topicLabel = texts.topicLabel;
  const roleLabel = texts.roleLabel;
  const buttonText = texts.buttonText;
  const preparationTip = texts.preparationTip;
  const rescheduleNotice = texts.rescheduleNotice;

  return (
    <Layout lang={lang}>
      <Header previewText={preview} />

      <Heading style={styles.heading}>{title}</Heading>

      <Text style={styles.text}>{greeting}</Text>
      <Text style={styles.text}>{description}</Text>

      <Section style={styles.card}>
        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>{timeLabel}</span>
          <span style={styles.detailValuePrimary}>{scheduledTime}</span>
        </div>
        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>{partnerLabel}</span>
          <span style={styles.detailValue}>{partnerName}</span>
        </div>
        {role && (
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>{roleLabel}</span>
            <span style={styles.detailValue}>{role}</span>
          </div>
        )}
        {topic && (
          <div
            style={{
              ...styles.detailRow,
              borderBottom: "none",
              paddingBottom: 0,
            }}
          >
            <span style={styles.detailLabel}>{topicLabel}</span>
            <span style={styles.detailValue}>{topic}</span>
          </div>
        )}
      </Section>

      <Button href={roomUrl} variant="primary">
        {buttonText}
      </Button>

      <Section style={styles.tipBox}>
        <Text style={styles.tipText}>💡 {preparationTip}</Text>
      </Section>

      <Text style={styles.mutedText}>{rescheduleNotice}</Text>

      <Footer lang={lang} />
    </Layout>
  );
};

// Мок-данные для предпросмотра в браузере (react-email)
InterviewScheduledTemplate.PreviewProps = {
  username: "Алексей",
  partnerName: "Дмитрий Ковалев",
  scheduledTime: "15 октября 2026, 18:00 (МСК)",
  roomUrl: "http://localhost:3000/room/mock-room-abc-123",
  role: "Кандидат",
  topic: "Frontend: React, TypeScript, System Design",
  lang: "en",
} satisfies InterviewScheduledProps;

export default InterviewScheduledTemplate;

const styles = {
  heading: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#ffffff",
    margin: "0 0 20px 0",
    textAlign: "center" as const,
  },
  text: {
    fontSize: "15px",
    lineHeight: "24px",
    color: "#e2e8f0",
    margin: "0 0 16px 0",
  },
  card: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "10px",
    padding: "16px 20px",
    margin: "20px 0",
  },
  detailRow: {
    padding: "8px 0",
    borderBottom: "1px solid #1e293b",
  },
  detailLabel: {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    color: "#94a3b8",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    marginBottom: "4px",
  },
  detailValue: {
    fontSize: "15px",
    fontWeight: 500,
    color: "#f8fafc",
  },
  detailValuePrimary: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#818cf8",
  },
  tipBox: {
    backgroundColor: "#0f172a",
    borderLeft: "4px solid #6366f1",
    borderRadius: "4px",
    padding: "12px 16px",
    margin: "20px 0 12px 0",
  },
  tipText: {
    fontSize: "13px",
    lineHeight: "20px",
    color: "#cbd5e1",
    margin: 0,
  },
  mutedText: {
    fontSize: "13px",
    lineHeight: "20px",
    color: "#94a3b8",
    margin: "12px 0 0 0",
    textAlign: "center" as const,
  },
} as const;
