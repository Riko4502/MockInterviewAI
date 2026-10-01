import { Hr, Link, Section, Text } from "@react-email/components";

/**
 * Пропсы для подвала письма.
 */
export interface FooterProps {
  /** Ссылка на настройки уведомлений в профиле */
  manageNotificationsUrl?: string;
  /** Текст ссылки на настройки */
  manageNotificationsText?: string;
  /** Название платформы */
  companyName?: string;
  /** Локализованный текст дисклеймера */
  disclaimerText?: string;
}

const DEFAULT_FRONTEND_URL = process.env.FRONTEND_URL ?? "test-url";

/**
 * Базовый футер с дисклеймером, ссылкой на настройки и копирайтом.
 */
export const Footer = ({
  manageNotificationsUrl = `${DEFAULT_FRONTEND_URL}/dashboard/profile`,
  manageNotificationsText = "Управление уведомлениями в профиле",
  companyName = "MockInterviewAI",
  disclaimerText,
}: FooterProps) => {
  const currentYear = new Date().getFullYear();
  const defaultDisclaimer = `Вы получили это письмо, потому что зарегистрированы на платформе ${companyName}. Если вы не совершали никаких действий, пожалуйста, проигнорируйте его.`;

  return (
    <Section style={styles.container}>
      <Hr style={styles.hr} />

      <Text style={styles.disclaimer}>
        {disclaimerText ?? defaultDisclaimer}
      </Text>

      {manageNotificationsUrl && (
        <Text style={styles.linkWrapper}>
          <Link href={manageNotificationsUrl} style={styles.link}>
            {manageNotificationsText}
          </Link>
        </Text>
      )}

      <Text style={styles.copyright}>
        © {currentYear} {companyName}. Все права защищены.
      </Text>
    </Section>
  );
};

const styles = {
  container: {
    marginTop: "32px",
    textAlign: "center" as const,
  },
  hr: {
    borderColor: "#1f2937",
    margin: "24px 0 20px 0",
    borderWidth: "1px",
    borderStyle: "solid",
  },
  disclaimer: {
    fontSize: "12px",
    lineHeight: "18px",
    color: "#94a3b8",
    margin: "0 0 12px 0",
  },
  linkWrapper: {
    margin: "0 0 12px 0",
  },
  link: {
    fontSize: "12px",
    color: "#6366f1",
    textDecoration: "underline",
  },
  copyright: {
    fontSize: "12px",
    color: "#64748b",
    margin: 0,
  },
} as const;
