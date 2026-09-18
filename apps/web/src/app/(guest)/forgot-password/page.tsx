import { defaultLocale, getMessages } from "@packages/i18n";
import { ForgotPasswordForm } from "@/features/auth";
import { AuthCard } from "@/widgets/auth-card";

export default function ForgotPasswordPage() {
  const dict = getMessages(defaultLocale);

  return (
    <AuthCard title={dict.auth.forgotPassword.title}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
