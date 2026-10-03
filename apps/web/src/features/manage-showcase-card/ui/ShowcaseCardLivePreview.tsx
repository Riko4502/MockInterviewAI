"use client";

import type { UserProfileDto } from "@packages/api";
import { useTranslation } from "react-i18next";
import {
  ShowcaseCard,
  type ShowcaseCardResponseDto,
} from "@/entities/showcase-card";
import "@/shared/lib/i18n";
import type { ShowcaseFormValues } from "../model/showcase-form-schema";

export interface ShowcaseCardLivePreviewProps {
  values: Partial<ShowcaseFormValues>;
  user?: Partial<UserProfileDto> | null;
  className?: string;
}

export function ShowcaseCardLivePreview({
  values,
  user,
  className,
}: ShowcaseCardLivePreviewProps) {
  const { t } = useTranslation("showcase");

  const previewCard: ShowcaseCardResponseDto = {
    id: "preview-card-id",
    userId: user?.id || "preview-user-id",
    user: {
      id: user?.id || "preview-user-id",
      displayName: user?.displayName || null,
      username: user?.username || null,
      avatarUrl: user?.avatarUrl || null,
      telegramUsername: null,
      gitUrl: null,
    },
    title: values.title?.trim() || null,
    specialization: values.specialization || "FRONTEND",
    level: values.level || "MIDDLE",
    language: values.language || "RU",
    skills:
      values.skills && values.skills.length > 0
        ? values.skills
        : ["React", "TypeScript"],
    bio: values.bio?.trim() || null,
    scheduleInfo: values.scheduleInfo?.trim() || null,
    isUrgent: values.isUrgent ?? false,
    status: "ACTIVE",
    autoRenew: values.autoRenew ?? false,
    bumpedAt: new Date(),
    expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return (
    <div className={className}>
      <div className="mb-2.5 flex items-center justify-between">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("form.previewTitle")}
          </h4>
          <p className="text-[11px] text-muted-foreground/80">
            {t("form.previewHint")}
          </p>
        </div>
      </div>

      <ShowcaseCard
        card={previewCard}
        isOwner={false}
        className="pointer-events-none select-none shadow-xs border-primary/20 bg-card/90"
      />
    </div>
  );
}
