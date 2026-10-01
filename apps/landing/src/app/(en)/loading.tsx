import { getMessages } from "@packages/i18n";
import { LoadingScreen } from "@packages/ui";

export default function EnLoading() {
  const t = getMessages("en").common.loading;

  return (
    <LoadingScreen
      title={t.landingTitle}
      badgeText={t.badges.system}
      description={t.descriptions.landing}
      steps={t.steps.landing}
      systemActiveText={t.systemActive}
      brandLabel={t.brandLabel}
    />
  );
}
