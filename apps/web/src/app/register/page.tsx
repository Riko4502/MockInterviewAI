import { Logo, Typography } from "@packages/ui";
import { RegisterForm } from "@/features/auth";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="mb-6 flex justify-center">
        <Logo href="/" variant="full" size="lg" />
      </div>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <Typography.H1 className="mb-6 text-center text-2xl font-semibold text-foreground">
          Регистрация
        </Typography.H1>
        <RegisterForm />
      </div>
    </main>
  );
}
