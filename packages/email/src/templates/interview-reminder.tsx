import { getMessages, type Locale } from "@packages/i18n";
import { Heading, Section, Text } from "@react-email/components";

import { Button } from "../components/button";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
import { Layout } from "../components/layout";

/**
 * Локализованные тексты для шаблона напоминания об интервью.
 */
export interface InterviewReminderTexts {
  previewText: string;
  title: string;
  greeting: string;
  description: string;
  partnerLabel: string;
  timeRemainingLabel: string;
  timeRemainingValue: string;
  topicLabel: string;
  buttonText: string;
  checklistTitle: string;
  checklistMic: string;
  checklistCamera: string;
  checklistInternet: string;
  checklistQuiet: string;
}

/**
 * Пропсы шаблона напоминания об интервью.
 */
export interface InterviewReminderProps {
  /** Имя текущего пользователя (получателя письма) */
  username?: string;
  /** Имя партнера по собеседованию */
  partnerName: string;
  /** Оставшееся время до старта в минутах */
  minutesUntilStart: number;
  /** Прямая ссылка на комнату видеовстречи */
  roomUrl: string;
  /** Направление или тема собеседования */
  topic?: string;
  /** Локаль письма */
  lang?: Locale;
  /** Опциональное переопределение текстов */
  texts?: Partial<InterviewReminderTexts>;
}

/**
 * Шаблон письма-напоминания о скором начале собеседования (обычно за 15 минут).
 */
export const InterviewReminderTemplate = ({
  username,
  partnerName,
  minutesUntilStart,
  roomUrl,
  topic,
  lang = "ru",
  texts: userTexts,
}: InterviewReminderProps) => {
  const dict = getMessages(lang).email.interviewReminder;
  const texts: InterviewReminderTexts = { ...dict, ...userTexts };

  const preview = texts.previewText
    .replace("{partnerName}", partnerName)
    .replace("{minutesUntilStart}", String(minutesUntilStart));
  const title = texts.title;
  const greeting = username
    ? texts.greeting.replace("{username}", username)
    : texts.greeting.replace(", {username}", "").replace(" {username}", "");
  const description = texts.description.replace(
    "{minutesUntilStart}",
    String(minutesUntilStart),
  );
  const partnerLabel = texts.partnerLabel;
  const timeRemainingLabel = texts.timeRemainingLabel;
  const topicLabel = texts.topicLabel;
  const buttonText = texts.buttonText;
  const checklistTitle = texts.checklistTitle;
  const checklistMic = texts.checklistMic;
  const checklistCamera = texts.checklistCamera;
  const checklistInternet = texts.checklistInternet;
  const checklistQuiet = texts.checklistQuiet;

  return (
    <Layout lang={lang}>
      <Header previewText={preview} />

      <Heading style={styles.heading}>{title}</Heading>

      <Text style={styles.text}>{greeting}</Text>
      <Text style={styles.text}>{description}</Text>

      <Section style={styles.card}>
        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>{timeRemainingLabel}</span>
          <span style={styles.detailValuePrimary}>
            {texts.timeRemainingValue.replace(
              "{minutesUntilStart}",
              String(minutesUntilStart),
            )}
          </span>
        </div>
        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>{partnerLabel}</span>
          <span style={styles.detailValue}>{partnerName}</span>
        </div>
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

      <Section style={styles.checklistCard}>
        <Text style={styles.checklistTitle}>{checklistTitle}</Text>
        <ul style={styles.checklist}>
          <li style={styles.checklistItem}>🎙️ {checklistMic}</li>
          <li style={styles.checklistItem}>📷 {checklistCamera}</li>
          <li style={styles.checklistItem}>🌐 {checklistInternet}</li>
          <li style={styles.checklistItem}>🤫 {checklistQuiet}</li>
        </ul>
      </Section>

      <Footer lang={lang} />
    </Layout>
  );
};

// Мок-данные для предпросмотра в браузере (react-email)
InterviewReminderTemplate.PreviewProps = {
  username: "Алексей",
  partnerName: "Дмитрий Ковалев",
  minutesUntilStart: 15,
  roomUrl: "http://localhost:3000/room/mock-room-abc-123",
  topic: "Frontend: React, TypeScript, System Design",
  lang: "en",
} satisfies InterviewReminderProps;

export default InterviewReminderTemplate;

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
    color: "#f59e0b",
  },
  checklistCard: {
    backgroundColor: "#0b1222",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    padding: "16px 20px",
    margin: "24px 0 12px 0",
  },
  checklistTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#f8fafc",
    margin: "0 0 10px 0",
  },
  checklist: {
    margin: 0,
    paddingLeft: "4px",
    listStyleType: "none",
  },
  checklistItem: {
    fontSize: "13px",
    lineHeight: "22px",
    color: "#94a3b8",
    marginBottom: "6px",
  },
} as const;
