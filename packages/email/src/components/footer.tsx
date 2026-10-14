import { getMessages, type Locale } from "@packages/i18n";
import { Hr, Link, Section, Text } from "@react-email/components";

/**
 * Пропсы для подвала письма.
 */
export interface FooterProps {
  /** Ссылка на настройки уведомлений в профиле (если не передана, блок не выводится) */
  manageNotificationsUrl?: string;
  /** Текст ссылки на настройки */
  manageNotificationsText?: string;
  /** Название платформы */
  companyName?: string;
  /** Текст дисклеймера */
  disclaimerText?: string;
  /** Текст копирайта */
  copyrightText?: string;
  /** Языковая локаль письма */
  lang?: Locale;
}

/**
 * Базовый футер с дисклеймером, ссылкой на настройки и копирайтом.
 */
export const Footer = ({
  manageNotificationsUrl,
  manageNotificationsText,
  companyName,
  disclaimerText,
  copyrightText,
  lang = "ru",
}: FooterProps) => {
  const common = getMessages(lang).email.common;
  const currentYear = new Date().getFullYear();

  const company = companyName ?? common.appName;
  const disclaimer = (disclaimerText ?? common.footerNotice).replace(
    "{companyName}",
    company,
  );
  const copyright = (copyrightText ?? common.footerCopyright)
    .replace("{year}", String(currentYear))
    .replace("{companyName}", company);
  const manageText = manageNotificationsText ?? common.footerSettings;

  return (
    <Section style={styles.container}>
      <Hr style={styles.hr} />

      <Text style={styles.disclaimer}>{disclaimer}</Text>

      {manageNotificationsUrl && (
        <Text style={styles.linkWrapper}>
          <Link href={manageNotificationsUrl} style={styles.link}>
            {manageText}
          </Link>
        </Text>
      )}

      <Text style={styles.copyright}>{copyright}</Text>
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
