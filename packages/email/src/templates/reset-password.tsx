import { getMessages, type Locale } from "@packages/i18n";
import { Heading, Text } from "@react-email/components";
import { Button } from "../components/button";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
import { Layout } from "../components/layout";

/**
 * Локализованные тексты для шаблона сброса пароля.
 */
export interface ResetPasswordTexts {
  previewText: string;
  title: string;
  greeting: string;
  description: string;
  buttonText: string;
  expirationNotice: string;
  ignoreNotice: string;
}

/**
 * Пропсы шаблона сброса пароля.
 */
export interface ResetPasswordProps {
  /** Имя или логин пользователя */
  username: string;
  /** Одноразовая ссылка для установки нового пароля */
  resetUrl: string;
  /** Срок действия ссылки в минутах */
  expiresMinutes: number;
  /** Локаль письма */
  lang?: Locale;
  /** Опциональное переопределение текстов */
  texts?: Partial<ResetPasswordTexts>;
}

/**
 * Шаблон письма для восстановления забытого пароля.
 */
export const ResetPasswordTemplate = ({
  username,
  resetUrl,
  expiresMinutes,
  lang = "ru",
  texts: userTexts,
}: ResetPasswordProps) => {
  const dict = getMessages(lang).email.resetPassword;
  const texts: ResetPasswordTexts = { ...dict, ...userTexts };

  const preview = texts.previewText;
  const title = texts.title;
  const greeting = texts.greeting.replace("{username}", username);
  const description = texts.description;
  const buttonText = texts.buttonText;
  const expirationNotice = texts.expirationNotice.replace(
    "{expiresMinutes}",
    String(expiresMinutes),
  );
  const ignoreNotice = texts.ignoreNotice;

  return (
    <Layout lang={lang}>
      <Header previewText={preview} />

      <Heading style={styles.heading}>{title}</Heading>

      <Text style={styles.text}>{greeting}</Text>
      <Text style={styles.text}>{description}</Text>

      <Button href={resetUrl} variant="primary">
        {buttonText}
      </Button>

      <Text style={styles.mutedText}>{expirationNotice}</Text>
      <Text style={styles.mutedText}>{ignoreNotice}</Text>

      <Footer lang={lang} />
    </Layout>
  );
};

// Мок-данные для предпросмотра в браузере (react-email)
ResetPasswordTemplate.PreviewProps = {
  username: "Алексей",
  resetUrl: "http://localhost:3000/reset-password?token=mock-reset-token-12345",
  expiresMinutes: 15,
  lang: "en",
} satisfies ResetPasswordProps;

export default ResetPasswordTemplate;

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
  mutedText: {
    fontSize: "13px",
    lineHeight: "20px",
    color: "#94a3b8",
    margin: "12px 0 0 0",
    textAlign: "center" as const,
  },
} as const;
