import { defaultLocale, getMessages } from "@packages/i18n";
import { ForgotPasswordForm } from "@/features/auth";

export default function ForgotPasswordPage() {
  const dict = getMessages(defaultLocale);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold text-foreground">
          {dict.auth.forgotPassword.title}
        </h1>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
