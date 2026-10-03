"use client";

import type { LiveMatchToggleDto } from "@packages/api";
import { Badge, Card, Typography } from "@packages/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/entities/user";
import "@/shared/lib/i18n";
import { getGreetingKey } from "../../lib/get-greeting-key";
import { LiveMatchControl } from "./LiveMatchControl";

export interface DashboardHeroProps {
  displayName?: string;
  targetSpecialization?: LiveMatchToggleDto["specialization"];
  targetLevel?: LiveMatchToggleDto["level"];
}

export function DashboardHero({
  displayName,
  targetSpecialization,
  targetLevel,
}: DashboardHeroProps) {
  const { t } = useTranslation("dashboard");
  const profile = useCurrentUser();
  const [hour, setHour] = useState<number | null>(null);

  // Серверный и первый клиентский рендеринг совпадают; местное время читается только после гидратации.
  useEffect(() => {
    setHour(new Date().getHours());
  }, []);

  const name =
    displayName?.trim() ||
    profile.data?.displayName?.trim() ||
    profile.data?.username?.trim();
  const greeting =
    hour === null ? t("greeting.fallback") : t(getGreetingKey(hour));

  return (
    <Card className="overflow-hidden">
      <Card.Content className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,1fr)]">
        <div className="min-w-0 space-y-4">
          <Typography variant="h1" className="break-words text-2xl sm:text-3xl">
            {name ? t("greeting.named", { greeting, name }) : greeting}
          </Typography>
          <Typography variant="muted">{t("greeting.subtitle")}</Typography>
          {(targetSpecialization || targetLevel) && (
            <div className="flex flex-wrap gap-2">
              {targetSpecialization && (
                <Badge>{t(`specializations.${targetSpecialization}`)}</Badge>
              )}
              {targetLevel && <Badge>{t(`levels.${targetLevel}`)}</Badge>}
            </div>
          )}
          {profile.isError && !displayName && (
            <output className="block text-sm text-muted-foreground">
              {t("errors.profile")}
            </output>
          )}
        </div>
        <LiveMatchControl
          targetSpecialization={targetSpecialization}
          targetLevel={targetLevel}
        />
      </Card.Content>
    </Card>
  );
}
