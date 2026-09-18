import { defaultLocale, getMessages } from "@packages/i18n";
import { InvalidTokenAlert, ResetPasswordForm } from "@/features/auth";
import { AuthCard } from "@/widgets/auth-card";

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { token } = await searchParams;
  const dict = getMessages(defaultLocale);

  return (
    <AuthCard title={dict.auth.resetPassword.title}>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <InvalidTokenAlert
          title={dict.auth.resetPassword.invalidToken.missingTitle}
          description={dict.auth.resetPassword.invalidToken.missingDescription}
        />
      )}
    </AuthCard>
  );
}
