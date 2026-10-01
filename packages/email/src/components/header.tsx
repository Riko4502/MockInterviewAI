import { Img, Link, Preview, Section, Text } from "@react-email/components";

interface HeaderProps {
  /** Текст прехедера в списке входящих (до открытия письма) */
  previewText?: string;
  /** Ссылка на изображение логотипа (опционально) */
  logoUrl?: string;
  /** Ссылка при клике на логотип (по умолчанию главная страница) */
  homeUrl?: string;
}

const DEFAULT_FRONTEND_URL = process.env.FRONTEND_URL ?? "test-url";

export const Header = ({
  previewText,
  logoUrl,
  homeUrl = DEFAULT_FRONTEND_URL,
}: HeaderProps) => {
  return (
    <>
      {previewText && <Preview>{previewText}</Preview>}
      <Section style={styles.header}>
        <Link href={homeUrl} style={styles.brandLink}>
          {logoUrl ? (
            <Img src={logoUrl} alt="MockInterviewAI" width="36" height="36" />
          ) : (
            <span style={styles.logoBadge}>MI</span>
          )}
          <Text style={styles.brandText}>
            Mock<span style={styles.accentText}>Interview</span>AI
          </Text>
        </Link>
      </Section>
    </>
  );
};

const styles = {
  header: {
    marginBottom: "28px",
    textAlign: "center" as const,
  },
  brandLink: {
    display: "inline-flex",
    alignItems: "center",
    textDecoration: "none",
    gap: "10px",
  },
  logoBadge: {
    backgroundColor: "#4f46e5",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: "14px",
    padding: "6px 10px",
    borderRadius: "8px",
    letterSpacing: "1px",
    display: "inline-block",
  },
  brandText: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 700,
    color: "#ffffff",
    letterSpacing: "-0.5px",
    display: "inline-block",
  },
  accentText: {
    color: "#6366f1",
  },
} as const;
