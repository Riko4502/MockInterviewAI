"use client";

import { CheckIcon, ClockIcon, MessageSquareIcon } from "@packages/icons";
import { Badge, Button, Card } from "@packages/ui";
import { cn } from "@packages/utils";
import { useTranslation } from "react-i18next";
import { UserAvatar } from "@/entities/user";
import "@/shared/lib/i18n";
import type { ShowcaseCardProps } from "../model/types";
import { LanguageBadge } from "./LanguageBadge";
import { LevelBadge } from "./LevelBadge";
import { SpecializationBadge } from "./SpecializationBadge";
import { UrgentBadge } from "./UrgentBadge";

const MAX_VISIBLE_SKILLS = 6;

export function ShowcaseCard({
  card,
  isOwner = false,
  isRequested = false,
  onRespond,
  onManage,
  className,
  testId,
}: ShowcaseCardProps) {
  const { t } = useTranslation("showcase");

  const displayName =
    card.user.displayName || card.user.username || t("card.anonymousUser");
  const username = card.user.username ? `@${card.user.username}` : null;

  const defaultTitle = t("card.defaultTitle", {
    level: t(`levels.${card.level}`),
    specialization: t(`specializations.${card.specialization}`),
  });

  const title = card.title?.trim() || defaultTitle;
  const isInactive = card.status === "INACTIVE";
  const isExpired = card.status === "EXPIRED";

  const visibleSkills = card.skills.slice(0, MAX_VISIBLE_SKILLS);
  const hiddenSkillsCount = Math.max(
    0,
    card.skills.length - MAX_VISIBLE_SKILLS,
  );

  return (
    <Card
      data-testid={testId ?? `showcase-card-${card.id}`}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/70 bg-card p-5 shadow-xs transition-all duration-200 hover:border-primary/40 hover:shadow-md",
        (isInactive || isExpired) && "opacity-75 bg-muted/20 border-dashed",
        className,
      )}
    >
      <div className="flex flex-col gap-3.5">
        {/* Шапка карточки: Автор, аватар, статус или бейдж срочности */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar
              src={card.user.avatarUrl}
              name={displayName}
              size="md"
              className="ring-2 ring-border/50 shrink-0"
            />
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm text-foreground truncate">
                {displayName}
              </span>
              {username && (
                <span className="text-xs text-muted-foreground truncate">
                  {username}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isInactive && (
              <Badge variant="waiting" className="text-xs font-normal">
                {t("statuses.INACTIVE")}
              </Badge>
            )}
            {isExpired && (
              <Badge variant="statusDanger" className="text-xs font-normal">
                {t("statuses.EXPIRED")}
              </Badge>
            )}
            {card.isUrgent && !isInactive && !isExpired && <UrgentBadge />}
          </div>
        </div>

        {/* Заголовок анкеты */}
        <div className="flex flex-col gap-2">
          <h3
            className="text-base font-bold text-foreground leading-snug tracking-tight line-clamp-2"
            title={title}
          >
            {title}
          </h3>

          {/* Строка основных бейджей */}
          <div className="flex flex-wrap items-center gap-1.5">
            <SpecializationBadge specialization={card.specialization} />
            <LevelBadge level={card.level} />
            <LanguageBadge language={card.language} />
          </div>
        </div>

        {/* Ключевые навыки */}
        {card.skills && card.skills.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {visibleSkills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center rounded-md bg-muted/70 px-2 py-0.5 font-mono text-xs font-medium text-foreground/80 border border-border/40"
              >
                {skill}
              </span>
            ))}
            {hiddenSkillsCount > 0 && (
              <span
                className="inline-flex items-center rounded-md bg-muted/40 px-1.5 py-0.5 text-xs text-muted-foreground border border-border/30"
                title={card.skills.slice(MAX_VISIBLE_SKILLS).join(", ")}
              >
                +{hiddenSkillsCount}
              </span>
            )}
          </div>
        )}

        {/* Описание / Bio */}
        {card.bio && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 pt-0.5">
            {card.bio}
          </p>
        )}

        {/* Расписание / доступное время */}
        {card.scheduleInfo && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/90 bg-muted/30 rounded-md px-2.5 py-1.5 border border-border/30">
            <ClockIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{card.scheduleInfo}</span>
          </div>
        )}
      </div>

      {/* Футер карточки */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/50 pt-3.5">
        {/* Статистика для автора */}
        {isOwner && card.stats ? (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span
              className="flex items-center gap-1 font-medium"
              title={t("card.requests")}
            >
              <MessageSquareIcon className="size-3.5 text-primary" />
              <span>{card.stats.pendingRequestsCount}</span>
            </span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            {/* Свободное место под дату или статус */}
          </div>
        )}

        {/* Экшены карточки */}
        <div className="flex items-center gap-2 ml-auto">
          {isOwner ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onManage?.(card)}
              className="text-xs font-medium"
            >
              {t("card.manage")}
            </Button>
          ) : isRequested ? (
            <Button
              size="sm"
              variant="secondary"
              disabled
              className="text-xs font-medium gap-1.5 opacity-80 cursor-not-allowed"
            >
              <CheckIcon className="size-3.5 text-emerald-500" />
              <span>{t("card.requestSent")}</span>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="default"
              onClick={() => onRespond?.(card)}
              disabled={isInactive || isExpired}
              className="text-xs font-semibold shadow-xs"
            >
              {t("card.respond")}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
