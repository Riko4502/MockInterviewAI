import { defaultLocale, getMessages } from "@packages/i18n";
import { ResetPasswordPageClient } from "@/features/auth";
import { AuthCard } from "@/widgets/auth-card";

export default function ResetPasswordPage() {
  const dict = getMessages(defaultLocale);

  return (
    <AuthCard title={dict.auth.resetPassword.title}>
      {/*
        Токен передаётся через URL-фрагмент (#token=...) и читается
        на клиенте в ResetPasswordPageClient. Fragment не отправляется
        на сервер, не логируется прокси и не хранится в server logs.
      */}
      <ResetPasswordPageClient />
    </AuthCard>
  );
}
