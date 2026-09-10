import Link from "next/link";
import { LoginForm } from "@/features/auth";
import { paths } from "@/shared/config";
import { AuthCard } from "@/widgets/auth-card";

export default function LoginPage() {
  return (
    <AuthCard
      title="Авторизация"
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Нет аккаунта?{" "}
          <Link
            href={paths.register}
            className="font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            Зарегистрироваться
          </Link>
        </p>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
