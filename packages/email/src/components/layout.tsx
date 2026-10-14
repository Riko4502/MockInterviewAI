import { defaultLocale, type Locale } from "@packages/i18n";
import { Body, Container, Head, Html } from "@react-email/components";
import type React from "react";

interface LayoutProps {
  children?: React.ReactNode;
  lang?: Locale;
}

export const Layout = ({ children, lang = defaultLocale }: LayoutProps) => {
  return (
    <Html lang={lang}>
      <Head>
        <meta name="color-scheme" content="dark light" />
        <meta name="supported-color-schemes" content="dark light" />
      </Head>
      <Body style={styles.body}>
        <Container style={styles.container}>{children}</Container>
      </Body>
    </Html>
  );
};

const styles = {
  body: {
    backgroundColor: "#090d16",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    margin: 0,
    padding: "32px 16px",
    color: "#f8fafc",
    WebkitFontSmoothing: "antialiased",
  },
  container: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    maxWidth: "600px",
    margin: "0 auto",
    padding: "32px 28px",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
  },
} as const;
