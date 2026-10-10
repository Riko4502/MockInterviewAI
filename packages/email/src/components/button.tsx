import { Button as ReactEmailButton, Section } from "@react-email/components";
import type React from "react";

/**
 * Пропсы для CTA-кнопки письма.
 */
export interface ButtonProps {
  /** Ссылка для перехода */
  href: string;
  /** Текст или контент внутри кнопки */
  children: React.ReactNode;
  /** Вариант оформления кнопки */
  variant?: "primary" | "secondary";
  /** Выравнивание кнопки по горизонтали */
  align?: "left" | "center" | "right";
}

/**
 * Кнопка действия (CTA) с безопасными инлайн-стилями для почтовых клиентов.
 */
export const Button = ({
  href,
  children,
  variant = "primary",
  align = "center",
}: ButtonProps) => {
  const buttonStyle =
    variant === "primary" ? styles.primaryButton : styles.secondaryButton;

  return (
    <Section style={{ ...styles.section, textAlign: align }}>
      <ReactEmailButton href={href} style={buttonStyle}>
        {children}
      </ReactEmailButton>
    </Section>
  );
};

const styles = {
  section: {
    margin: "24px 0",
  },
  primaryButton: {
    backgroundColor: "#6366f1",
    backgroundImage: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
    borderRadius: "8px",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 600,
    textDecoration: "none",
    textAlign: "center" as const,
    display: "inline-block",
    padding: "12px 28px",
    boxShadow: "0 4px 12px rgba(99, 102, 241, 0.35)",
  },
  secondaryButton: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#f8fafc",
    fontSize: "15px",
    fontWeight: 500,
    textDecoration: "none",
    textAlign: "center" as const,
    display: "inline-block",
    padding: "12px 24px",
  },
} as const;
