import {
  defaultLocale,
  getMessages,
  type Locale,
  locales,
} from "@packages/i18n";
import { LoadingScreen } from "@packages/ui";
import { cookies } from "next/headers";

export default async function ProtectedLoading() {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get("locale")?.value;
  const locale: Locale = locales.includes(rawLocale as Locale)
    ? (rawLocale as Locale)
    : defaultLocale;
  const t = getMessages(locale).common.loading;

  return (
    <LoadingScreen
      title={t.title}
      badgeText={t.badges.workspace}
      description={t.descriptions.workspace}
      steps={t.steps.protected}
      systemActiveText={t.systemActive}
      brandLabel={t.brandLabel}
    />
  );
}
