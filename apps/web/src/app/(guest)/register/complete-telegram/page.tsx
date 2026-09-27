import { defaultLocale, getMessages } from "@packages/i18n";
import { cookies } from "next/headers";
import Link from "next/link";
import { CompleteTelegramPageClient } from "@/features/auth";
import { paths } from "@/shared/config";
import { AuthCard } from "@/widgets/auth-card";

export default async function CompleteTelegramPage() {
  const cookieStore = await cookies();
  const { auth } = getMessages(
    cookieStore.get("locale")?.value ?? defaultLocale,
  );

  return (
    <AuthCard
      title={auth.completeTelegram.title}
      footer={
        <p className="text-center text-sm text-muted-foreground">
          {auth.register.hasAccount}{" "}
          <Link
            href={paths.login}
            className="font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            {auth.register.loginLink}
          </Link>
        </p>
      }
    >
      <CompleteTelegramPageClient />
    </AuthCard>
  );
}
