"use client";

import type { MatchRequestResponseDto } from "@packages/api";
import { Button, Card } from "@packages/ui";
import { useTranslation } from "react-i18next";
import {
  LanguageBadge,
  LevelBadge,
  SpecializationBadge,
} from "@/entities/showcase-card";
import { UserAvatar } from "@/entities/user";
import "@/shared/lib/i18n";
import { MatchedSessionBanner } from "./MatchedSessionBanner";
import { MatchRequestStatusBadge } from "./MatchRequestStatusBadge";

export interface OutgoingRequestCardProps {
  req: MatchRequestResponseDto;
  onCancel: (id: string) => void;
  isCancelPending?: boolean;
}

export function OutgoingRequestCard({
  req,
  onCancel,
  isCancelPending = false,
}: OutgoingRequestCardProps) {
  const { t } = useTranslation("showcase");

  const receiverName =
    req.receiver.displayName ||
    req.receiver.username ||
    t("card.anonymousUser");
  const isPending = req.status === "PENDING";
  const isAccepted = req.status === "ACCEPTED";

  return (
    <Card className="rounded-xl border border-border/70 bg-card p-5 shadow-xs flex flex-col justify-between gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar
              src={req.receiver.avatarUrl}
              name={receiverName}
              size="md"
              className="ring-2 ring-border/50 shrink-0"
            />
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm text-foreground truncate">
                {receiverName}
              </span>
              {req.receiver.username && (
                <span className="text-xs text-muted-foreground truncate">
                  @{req.receiver.username}
                </span>
              )}
            </div>
          </div>

          <MatchRequestStatusBadge status={req.status} />
        </div>

        {/* Карточка, на которую отправлен отклик */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <SpecializationBadge specialization={req.targetCard.specialization} />
          <LevelBadge level={req.targetCard.level} />
          <LanguageBadge language={req.targetCard.language} />
        </div>

        {req.preferredTopic && (
          <div className="text-xs text-foreground/90 bg-muted/30 rounded-md p-2 border border-border/40">
            <span className="font-medium text-muted-foreground mr-1.5">
              {t("matchmaking.preferredTopic")}
            </span>
            <span>{req.preferredTopic}</span>
          </div>
        )}

        {req.message && (
          <p className="text-xs text-muted-foreground leading-relaxed italic">
            "{req.message}"
          </p>
        )}

        {/* Если заявка принята собеседником — показываем переход в интерактивную комнату */}
        {isAccepted && <MatchedSessionBanner sessionId={req.sessionId} />}
      </div>

      {isPending && (
        <div className="pt-3 border-t border-border/50 flex items-center justify-end">
          <Button
            size="sm"
            variant="outline"
            disabled={isCancelPending}
            onClick={() => onCancel(req.id)}
            className="text-xs cursor-pointer text-muted-foreground hover:text-foreground"
          >
            {t("matchmaking.cancel")}
          </Button>
        </div>
      )}
    </Card>
  );
}
