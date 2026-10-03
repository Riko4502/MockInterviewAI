"use client";

import { Button } from "@packages/ui";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";
import { useMatchRequestsHub } from "../model/use-match-requests-hub";
import { IncomingRequestCard } from "./IncomingRequestCard";
import { MatchRequestSkeleton } from "./MatchRequestSkeleton";
import { OutgoingRequestCard } from "./OutgoingRequestCard";

export interface MatchRequestsHubProps {
  className?: string;
}

export function MatchRequestsHub({ className }: MatchRequestsHubProps) {
  const { t } = useTranslation("showcase");
  const {
    activeTab,
    setActiveTab,
    incomingRequests,
    outgoingRequests,
    isIncomingLoading,
    isOutgoingLoading,
    handleAccept,
    handleReject,
    handleCancel,
    isAcceptPending,
    isRejectPending,
    isCancelPending,
  } = useMatchRequestsHub();

  return (
    <div className={`flex flex-col gap-6 ${className || ""}`}>
      {/* Подвкладки: Входящие / Исходящие */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setActiveTab("incoming")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === "incoming"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-muted/50 text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("matchmaking.incomingTab")} ({incomingRequests.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("outgoing")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === "outgoing"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-muted/50 text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("matchmaking.outgoingTab")} ({outgoingRequests.length})
        </button>
      </div>

      {/* Список заявок */}
      {activeTab === "incoming" ? (
        isIncomingLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((k) => (
              <MatchRequestSkeleton key={k} />
            ))}
          </div>
        ) : incomingRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 p-12 text-center">
            <h3 className="text-base font-bold text-foreground">
              {t("matchmaking.incomingEmpty")}
            </h3>
            <p className="mt-1.5 max-w-sm text-xs text-muted-foreground leading-relaxed">
              {t("matchmaking.incomingEmptyDesc")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {incomingRequests.map((req) => (
              <IncomingRequestCard
                key={req.id}
                req={req}
                onAccept={handleAccept}
                onReject={handleReject}
                isAcceptPending={isAcceptPending}
                isRejectPending={isRejectPending}
              />
            ))}
          </div>
        )
      ) : isOutgoingLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((k) => (
            <MatchRequestSkeleton key={k} />
          ))}
        </div>
      ) : outgoingRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 p-12 text-center">
          <h3 className="text-base font-bold text-foreground">
            {t("matchmaking.outgoingEmpty")}
          </h3>
          <p className="mt-1.5 max-w-sm text-xs text-muted-foreground leading-relaxed">
            {t("matchmaking.outgoingEmptyDesc")}
          </p>
          <Button asChild variant="default" size="sm" className="mt-5">
            <Link href={paths.partners}>{t("tabs.catalog")}</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {outgoingRequests.map((req) => (
            <OutgoingRequestCard
              key={req.id}
              req={req}
              onCancel={handleCancel}
              isCancelPending={isCancelPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
