"use client";

import type { UserProfileDto } from "@packages/api";
import type { AvailabilitySlot } from "@packages/types";
import { resolveLocalTimeToUtc } from "@packages/utils";
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
  /** IANA-таймзона автора: слоты формы — локальное время этой зоны. */
  authorTimezone?: string;
  className?: string;
}

export function ShowcaseCardLivePreview({
  values,
  user,
  authorTimezone = "UTC",
  className,
}: ShowcaseCardLivePreviewProps) {
  const { t } = useTranslation("showcase");

  // Слоты формы хранятся в локальном времени автора — в превью приводим их к
  // UTC-инстантам, которые ожидает доменный тип `AvailabilitySlot`.
  const previewSlots: AvailabilitySlot[] = (values.slots ?? []).flatMap(
    (slot, index) => {
      const resolution = resolveLocalTimeToUtc(
        slot.startsAtLocal,
        authorTimezone,
      );

      if (!resolution.ok) {
        return [];
      }

      return [
        {
          id: slot.id ?? `preview-slot-${index}`,
          startsAt: resolution.utc.toISOString(),
          durationMinutes: slot.durationMinutes,
          status: slot.booked ? "BOOKED" : "OPEN",
        },
      ];
    },
  );

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
    bumpedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slots: previewSlots,
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
