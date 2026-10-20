import { getMessages, type Locale } from "@packages/i18n";
import { Heading, Text } from "@react-email/components";

import { Button } from "../components/button";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
import { Layout } from "../components/layout";
import { OtpCode } from "../components/otp-code";

/**
 * Локализованные тексты для шаблона подтверждения email.
 */
export interface VerifyEmailTexts {
  previewText: string;
  title: string;
  greeting: string;
  description: string;
  buttonText: string;
  otpLabel: string;
  expirationNotice: string;
  ignoreNotice: string;
}

/**
 * Пропсы шаблона подтверждения email.
 */
export interface VerifyEmailProps {
  /** Имя или логин пользователя */
  username: string;
  /** Одноразовый код подтверждения (если используется ввод кода) */
  code?: string;
  /** Ссылка для прямого подтверждения по клику */
  verifyUrl?: string;
  /** Время жизни ссылки/кода в минутах */
  expiresMinutes: number;
  /** Локаль письма */
  lang: Locale;
  /** Переопределение текстов (например, из @packages/i18n) */
  texts?: Partial<VerifyEmailTexts>;
}

/**
 * Шаблон письма для подтверждения регистрации аккаунта.
 */
export const VerifyEmailTemplate = ({
  username,
  code,
  verifyUrl,
  expiresMinutes,
  lang = "ru",
  texts: userTexts,
}: VerifyEmailProps) => {
  const texts: VerifyEmailTexts = {
    ...getMessages(lang).email.verifyEmail,
    ...userTexts,
  };

  const preview = texts.previewText;
  const title = texts.title;
  const greeting = texts.greeting.replace("{username}", username);
  const description = texts.description;
  const buttonText = texts.buttonText;
  const otpLabel = texts.otpLabel;
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

      {verifyUrl && (
        <Button href={verifyUrl} variant="primary">
          {buttonText}
        </Button>
      )}

      {code && <OtpCode code={code} label={otpLabel} />}

      <Text style={styles.mutedText}>{expirationNotice}</Text>
      <Text style={styles.mutedText}>{ignoreNotice}</Text>

      <Footer lang={lang} />
    </Layout>
  );
};

// Мок-данные для React Email Preview сервера
VerifyEmailTemplate.PreviewProps = {
  username: "Alex",
  code: "482910",
  verifyUrl: "http://localhost:3000/auth/verify?token=mock-token-12345",
  expiresMinutes: 15,
  lang: "en",
} satisfies VerifyEmailProps;

export default VerifyEmailTemplate;

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
