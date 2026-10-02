"use client";

import { Badge } from "@packages/ui";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";

export interface MatchRequestStatusBadgeProps {
  status: string;
}

export function MatchRequestStatusBadge({
  status,
}: MatchRequestStatusBadgeProps) {
  const { t } = useTranslation("showcase");

  switch (status) {
    case "ACCEPTED":
      return (
        <Badge variant="statusSuccess" className="text-xs">
          {t("matchmaking.acceptedBadge")}
        </Badge>
      );
    case "REJECTED":
      return (
        <Badge variant="statusDanger" className="text-xs">
          {t("matchmaking.rejectedBadge")}
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge variant="secondary" className="text-xs">
          {t("matchmaking.cancelledBadge")}
        </Badge>
      );
    default:
      return (
        <Badge variant="waiting" className="text-xs">
          {t("matchmaking.pendingBadge")}
        </Badge>
      );
  }
}
