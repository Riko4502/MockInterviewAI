import { Section, Text } from "@react-email/components";

/**
 * Пропсы для блока одноразового проверочного кода.
 */
export interface OtpCodeProps {
  /** Сам одноразовый проверочный код (цифры или буквы) */
  code: string;
  /** Поясняющий заголовок перед кодом (опционально) */
  label?: string;
}

/**
 * Компонент отображения одноразового кода верификации (OTP / 2FA).
 */
export const OtpCode = ({
  code,
  label = "Одноразовый проверочный код:",
}: OtpCodeProps) => {
  return (
    <Section style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <div style={styles.codeBox}>
        <Text style={styles.codeText}>{code}</Text>
      </div>
    </Section>
  );
};

const styles = {
  container: {
    margin: "24px 0",
    textAlign: "center" as const,
  },
  label: {
    fontSize: "13px",
    color: "#94a3b8",
    margin: "0 0 8px 0",
  },
  codeBox: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "10px",
    padding: "16px 24px",
    display: "inline-block",
  },
  codeText: {
    fontFamily: "Courier, Monaco, 'Courier New', monospace",
    fontSize: "30px",
    fontWeight: 700,
    color: "#38bdf8",
    letterSpacing: "8px",
    margin: 0,
    paddingLeft: "8px", // компенсация letter-spacing для ровного центрирования
  },
} as const;
