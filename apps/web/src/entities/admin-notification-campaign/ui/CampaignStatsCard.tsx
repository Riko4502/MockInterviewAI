"use client";

import { Progress, Typography } from "@packages/ui";
import { useTranslation } from "react-i18next";
import type { CampaignStats } from "../model/types";

export interface CampaignStatsCardProps {
  stats: CampaignStats;
}

function percentage(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export function CampaignStatsCard({ stats }: CampaignStatsCardProps) {
  const { t } = useTranslation("common");
  const sent = Math.min(stats.sentCount, stats.totalRecipients);
  const read = Math.min(stats.readCount, stats.totalRecipients);
  const deliveryRate = percentage(sent, stats.totalRecipients);
  const readRate = percentage(read, stats.totalRecipients);
  const label = (key: string) => t(key, { defaultValue: key });

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <Typography.H3 className="mb-4">
        {label("adminNotifications.stats.title")}
      </Typography.H3>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Typography.Muted>
            {label("adminNotifications.stats.recipients")}
          </Typography.Muted>
          <Typography.Large>{stats.totalRecipients}</Typography.Large>
        </div>
        <div>
          <Typography.Muted>
            {label("adminNotifications.stats.sent")}
          </Typography.Muted>
          <Typography.Large>{sent}</Typography.Large>
        </div>
        <div>
          <Typography.Muted>
            {label("adminNotifications.stats.read")}
          </Typography.Muted>
          <Typography.Large>{read}</Typography.Large>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span>{label("adminNotifications.stats.deliveryRate")}</span>
            <span>{deliveryRate}%</span>
          </div>
          <Progress
            value={deliveryRate}
            aria-label={label("adminNotifications.stats.deliveryRate")}
          />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span>{label("adminNotifications.stats.readRate")}</span>
            <span>{readRate}%</span>
          </div>
          <Progress
            value={readRate}
            aria-label={label("adminNotifications.stats.readRate")}
          />
        </div>
      </div>
    </section>
  );
}
