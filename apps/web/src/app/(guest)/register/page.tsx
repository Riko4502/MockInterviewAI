import Link from "next/link";
import { RegisterForm } from "@/features/auth";
import { paths } from "@/shared/config";
import { AuthCard } from "@/widgets/auth-card";

export default function RegisterPage() {
  return (
    <AuthCard
      title="Регистрация"
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Уже есть аккаунт?{" "}
          <Link
            href={paths.login}
            className="font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            Войти
          </Link>
        </p>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
