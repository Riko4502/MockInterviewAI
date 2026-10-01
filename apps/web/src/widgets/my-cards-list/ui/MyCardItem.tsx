"use client";

import { EditIcon, MessageSquareIcon, TrashIcon } from "@packages/icons";
import { Badge, Button, Card } from "@packages/ui";
import { cn } from "@packages/utils";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  LanguageBadge,
  LevelBadge,
  type ShowcaseCardResponseDto,
  SkillBadge,
  SpecializationBadge,
  UrgentBadge,
} from "@/entities/showcase-card";
import {
  BumpCardButton,
  useShowcaseMutations,
} from "@/features/manage-showcase-card";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";

export interface MyCardItemProps {
  card: ShowcaseCardResponseDto;
  onDelete: (cardId: string) => void;
  className?: string;
}

export function MyCardItem({ card, onDelete, className }: MyCardItemProps) {
  const { t } = useTranslation("showcase");
  const { toggleStatus, isTogglingStatus } = useShowcaseMutations();

  const isInactive = card.status === "INACTIVE";
  const isExpired = card.status === "EXPIRED";

  const defaultTitle = t("card.defaultTitle", {
    level: t(`levels.${card.level}`),
    specialization: t(`specializations.${card.specialization}`),
  });

  const title = card.title?.trim() || defaultTitle;

  return (
    <Card
      className={cn(
        "flex flex-col justify-between overflow-hidden rounded-xl border border-border/70 bg-card p-5 shadow-xs transition-all",
        (isInactive || isExpired) && "opacity-75 bg-muted/20 border-dashed",
        className,
      )}
    >
      <div className="flex flex-col gap-3.5">
        {/* Шапка: статус, срочность, автопродление */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {card.status === "ACTIVE" && (
              <Badge variant="statusSuccess" className="text-xs font-medium">
                {t("statuses.ACTIVE")}
              </Badge>
            )}
            {isInactive && (
              <Badge variant="waiting" className="text-xs font-medium">
                {t("statuses.INACTIVE")}
              </Badge>
            )}
            {isExpired && (
              <Badge variant="statusDanger" className="text-xs font-medium">
                {t("statuses.EXPIRED")}
              </Badge>
            )}
            {card.isUrgent && <UrgentBadge iconOnly />}
          </div>

          {card.stats && (
            <Link
              href={paths.partnersRequests}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/70 transition-colors px-2.5 py-1 rounded-md border border-border/40 cursor-pointer"
              title={t("card.requests")}
            >
              <MessageSquareIcon className="size-3.5 text-primary" />
              <span className="font-semibold text-foreground">
                {card.stats.pendingRequestsCount}
              </span>
              <span>{t("card.responsesCount")}</span>
            </Link>
          )}
        </div>

        {/* Заголовок */}
        <div className="flex flex-col gap-1.5">
          <h3 className="text-base font-bold text-foreground leading-snug tracking-tight line-clamp-2">
            {title}
          </h3>

          <div className="flex flex-wrap items-center gap-1.5">
            <SpecializationBadge specialization={card.specialization} />
            <LevelBadge level={card.level} />
            <LanguageBadge language={card.language} />
          </div>
        </div>

        {/* Навыки */}
        {card.skills && card.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {card.skills.map((skill) => (
              <SkillBadge key={skill} skill={skill} />
            ))}
          </div>
        )}

        {/* Bio */}
        {card.bio && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {card.bio}
          </p>
        )}
      </div>

      {/* Панель действий */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3.5">
        <div className="flex items-center gap-1.5">
          <BumpCardButton cardId={card.id} bumpedAt={card.bumpedAt} />

          {/* Переключение статуса */}
          <Button
            variant="ghost"
            size="sm"
            disabled={isExpired || isTogglingStatus}
            onClick={() =>
              toggleStatus(card.id, card.status as "ACTIVE" | "INACTIVE")
            }
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {isInactive ? t("actions.activate") : t("actions.hide")}
          </Button>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <Button
            asChild
            variant="ghost"
            size="icon-xs"
            title={t("actions.edit")}
            className="text-muted-foreground hover:text-foreground"
          >
            <Link href={paths.partnersEdit(card.id)}>
              <EditIcon className="size-3.5" />
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onDelete(card.id)}
            title={t("actions.delete")}
            className="text-muted-foreground hover:text-destructive"
          >
            <TrashIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
