import { defaultLocale, getMessages } from "@packages/i18n";
import { InvalidTokenAlert, ResetPasswordForm } from "@/features/auth";

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { token } = await searchParams;
  const dict = getMessages(defaultLocale);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold text-foreground">
          {dict.auth.resetPassword.title}
        </h1>
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <InvalidTokenAlert
            title={dict.auth.resetPassword.invalidToken.missingTitle}
            description={
              dict.auth.resetPassword.invalidToken.missingDescription
            }
          />
        )}
      </div>
    </main>
  );
}
