"use client";

import type { MatchRequestResponseDto } from "@packages/api";
import { CheckIcon } from "@packages/icons";
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

export interface IncomingRequestCardProps {
  req: MatchRequestResponseDto;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  isAcceptPending?: boolean;
  isRejectPending?: boolean;
}

export function IncomingRequestCard({
  req,
  onAccept,
  onReject,
  isAcceptPending = false,
  isRejectPending = false,
}: IncomingRequestCardProps) {
  const { t } = useTranslation("showcase");

  const senderName =
    req.sender.displayName || req.sender.username || t("card.anonymousUser");
  const isPending = req.status === "PENDING";
  const isAccepted = req.status === "ACCEPTED";

  return (
    <Card className="rounded-xl border border-border/70 bg-card p-5 shadow-xs flex flex-col justify-between gap-4">
      <div className="flex flex-col gap-3">
        {/* Шапка заявки */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar
              src={req.sender.avatarUrl}
              name={senderName}
              size="md"
              className="ring-2 ring-border/50 shrink-0"
            />
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm text-foreground truncate">
                {senderName}
              </span>
              {req.sender.username && (
                <span className="text-xs text-muted-foreground truncate">
                  @{req.sender.username}
                </span>
              )}
            </div>
          </div>

          <MatchRequestStatusBadge status={req.status} />
        </div>

        {/* Карточка витрины отправителя (если прикреплена) */}
        {req.senderCard && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <SpecializationBadge
              specialization={req.senderCard.specialization}
            />
            <LevelBadge level={req.senderCard.level} />
            <LanguageBadge language={req.senderCard.language} />
          </div>
        )}

        {/* Тема и сообщение */}
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

        {/* Если заявка принята — показываем переход в интерактивную комнату */}
        {isAccepted && (
          <MatchedSessionBanner
            sessionId={req.sessionId}
            sessionStatus={req.sessionStatus}
          />
        )}
      </div>

      {/* Кнопки действий для входящей заявки */}
      {isPending && (
        <div className="pt-3 border-t border-border/50 flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={isRejectPending}
            onClick={() => onReject(req.id)}
            className="text-xs cursor-pointer"
          >
            {t("matchmaking.reject")}
          </Button>
          <Button
            size="sm"
            variant="default"
            disabled={isAcceptPending}
            onClick={() => onAccept(req.id)}
            className="text-xs font-semibold shadow-xs cursor-pointer gap-1.5"
          >
            <CheckIcon className="size-3.5" />
            <span>{t("matchmaking.accept")}</span>
          </Button>
        </div>
      )}
    </Card>
  );
}
