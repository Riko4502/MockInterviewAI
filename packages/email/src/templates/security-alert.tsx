import type { Locale } from "@packages/i18n";
import { Heading, Section, Text } from "@react-email/components";

import { Button } from "../components/button";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
import { Layout } from "../components/layout";

/**
 * Типы событий безопасности аккаунта.
 */
export type SecurityEventType =
  | "PASSWORD_CHANGED"
  | "EMAIL_CHANGE_REQUESTED"
  | "EMAIL_CHANGED"
  | "NEW_DEVICE_LOGIN";

/**
 * Дополнительные сведения о событии безопасности.
 */
export interface SecurityAlertDetails {
  oldEmail?: string;
  newEmail?: string;
  confirmationUrl?: string;
}

/**
 * Локализованные тексты для шаблона оповещения о безопасности.
 */
export interface SecurityAlertTexts {
  previewText?: string;
  title?: string;
  greeting?: string;
  description?: string;
  eventLabel?: string;
  timeLabel?: string;
  ipLabel?: string;
  deviceLabel?: string;
  locationLabel?: string;
  newEmailLabel?: string;
  oldEmailLabel?: string;
  buttonText?: string;
  warningNotice?: string;
  supportNotice?: string;
}

/**
 * Пропсы шаблона оповещения о безопасности.
 */
export interface SecurityAlertProps {
  /** Тип события безопасности */
  eventType: SecurityEventType;
  /** Email пользователя */
  email?: string;
  /** Имя или логин пользователя */
  username?: string;
  /** Время события (строка или ISO 8601) */
  timestamp: string;
  /** IP-адрес, с которого было выполнено действие */
  ipAddress: string;
  /** User-Agent браузера / клиента */
  userAgent?: string;
  /** Читаемое название устройства / браузера */
  device?: string;
  /** Географическое местоположение (если определено) */
  location?: string;
  /** Дополнительные параметры события */
  details?: SecurityAlertDetails;
  /** Ссылка на страницу управления безопасностью аккаунта */
  securityUrl?: string;
  /** Локаль письма */
  lang?: Locale;
  /** Переопределение текстов */
  texts?: SecurityAlertTexts;
}

const EVENT_TITLES: Record<SecurityEventType, string> = {
  PASSWORD_CHANGED: "Пароль был изменен",
  EMAIL_CHANGE_REQUESTED: "Запрос на смену email",
  EMAIL_CHANGED: "Email аккаунта изменен",
  NEW_DEVICE_LOGIN: "Вход с нового устройства",
};

const EVENT_DESCRIPTIONS: Record<SecurityEventType, string> = {
  PASSWORD_CHANGED:
    "Пароль от вашего аккаунта MockInterviewAI был успешно изменен. Если это были вы, никаких дополнительных действий не требуется.",
  EMAIL_CHANGE_REQUESTED:
    "Был получен запрос на смену основного адреса электронной почты для вашего аккаунта.",
  EMAIL_CHANGED:
    "Основной адрес электронной почты вашего аккаунта MockInterviewAI был успешно обновлен.",
  NEW_DEVICE_LOGIN:
    "Был зафиксирован вход в ваш аккаунт MockInterviewAI с нового устройства или необычного местоположения.",
};

/**
 * Шаблон письма с оповещением о критических событиях безопасности.
 */
export const SecurityAlertTemplate = ({
  eventType,
  email,
  username,
  timestamp,
  ipAddress,
  userAgent,
  device,
  location,
  details,
  securityUrl = "http://localhost:3000/dashboard/profile",
  lang,
  texts,
}: SecurityAlertProps) => {
  const title = texts?.title ?? EVENT_TITLES[eventType];
  const preview = texts?.previewText ?? `Безопасность аккаунта: ${title}`;
  const greeting =
    texts?.greeting ??
    (username
      ? `Здравствуйте, ${username}!`
      : email
        ? `Здравствуйте (${email})!`
        : "Здравствуйте!");
  const description = texts?.description ?? EVENT_DESCRIPTIONS[eventType];
  const timeLabel = texts?.timeLabel ?? "Время события:";
  const ipLabel = texts?.ipLabel ?? "IP-адрес:";
  const deviceLabel = texts?.deviceLabel ?? "Устройство / Браузер:";
  const locationLabel = texts?.locationLabel ?? "Примерное место:";
  const newEmailLabel = texts?.newEmailLabel ?? "Новый email:";
  const oldEmailLabel = texts?.oldEmailLabel ?? "Прежний email:";

  const primaryActionUrl = details?.confirmationUrl ?? securityUrl;
  const buttonText =
    texts?.buttonText ??
    (details?.confirmationUrl
      ? "Подтвердить изменение"
      : "Проверить безопасность аккаунта");

  const warningNotice =
    texts?.warningNotice ??
    "Если вы не совершали этих действий, немедленно смените пароль и завершите все активные сессии в настройках безопасности.";

  const displayDevice = device ?? userAgent;

  return (
    <Layout lang={lang}>
      <Header previewText={preview} />

      <Section style={styles.alertBadge}>
        <Text style={styles.alertBadgeText}>⚠️ Оповещение безопасности</Text>
      </Section>

      <Heading style={styles.heading}>{title}</Heading>

      <Text style={styles.text}>{greeting}</Text>
      <Text style={styles.text}>{description}</Text>

      <Section style={styles.card}>
        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>{timeLabel}</span>
          <span style={styles.detailValue}>{timestamp}</span>
        </div>
        <div style={styles.detailRow}>
          <span style={styles.detailLabel}>{ipLabel}</span>
          <span style={styles.detailValuePrimary}>{ipAddress}</span>
        </div>
        {displayDevice && (
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>{deviceLabel}</span>
            <span style={styles.detailValue}>{displayDevice}</span>
          </div>
        )}
        {location && (
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>{locationLabel}</span>
            <span style={styles.detailValue}>{location}</span>
          </div>
        )}
        {details?.oldEmail && (
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>{oldEmailLabel}</span>
            <span style={styles.detailValue}>{details.oldEmail}</span>
          </div>
        )}
        {details?.newEmail && (
          <div
            style={{
              ...styles.detailRow,
              borderBottom: "none",
              paddingBottom: 0,
            }}
          >
            <span style={styles.detailLabel}>{newEmailLabel}</span>
            <span style={styles.detailValuePrimary}>{details.newEmail}</span>
          </div>
        )}
      </Section>

      <Button href={primaryActionUrl} variant="primary">
        {buttonText}
      </Button>

      <Section style={styles.warningBox}>
        <Text style={styles.warningText}>🔒 {warningNotice}</Text>
      </Section>

      <Footer />
    </Layout>
  );
};

// Мок-данные для предпросмотра в браузере (react-email)
SecurityAlertTemplate.PreviewProps = {
  eventType: "NEW_DEVICE_LOGIN",
  username: "Алексей",
  email: "alex@example.com",
  timestamp: "1 октября 2026, 20:30 (МСК)",
  ipAddress: "194.87.12.45",
  device: "Chrome 128 / macOS Sonoma",
  location: "Москва, Россия",
  securityUrl: "http://localhost:3000/dashboard/profile",
} satisfies SecurityAlertProps;

export default SecurityAlertTemplate;

const styles = {
  alertBadge: {
    textAlign: "center" as const,
    marginBottom: "12px",
  },
  alertBadgeText: {
    display: "inline-block",
    fontSize: "12px",
    fontWeight: 600,
    color: "#fb7185",
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    border: "1px solid rgba(244, 63, 94, 0.3)",
    borderRadius: "16px",
    padding: "4px 12px",
    margin: 0,
  },
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
    fontSize: "15px",
    fontWeight: 600,
    color: "#818cf8",
  },
  warningBox: {
    backgroundColor: "rgba(244, 63, 94, 0.08)",
    borderLeft: "4px solid #f43f5e",
    borderRadius: "4px",
    padding: "12px 16px",
    margin: "24px 0 12px 0",
  },
  warningText: {
    fontSize: "13px",
    lineHeight: "20px",
    color: "#fca5a5",
    margin: 0,
  },
} as const;
