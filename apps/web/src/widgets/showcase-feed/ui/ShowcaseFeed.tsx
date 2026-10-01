"use client";

import { useMatchmakingControllerFindOutgoing } from "@packages/api";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ShowcaseCard,
  type ShowcaseCardResponseDto,
  ShowcaseCardSkeleton,
  useShowcaseCatalog,
} from "@/entities/showcase-card";
import { useCurrentUser } from "@/entities/user";
import { SendMatchRequestDialog } from "@/features/send-match-request";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";
import { ShowcaseEmptyState } from "./ShowcaseEmptyState";
import {
  ShowcaseFiltersBar,
  type ShowcaseFiltersState,
} from "./ShowcaseFiltersBar";
import { ShowcaseSearchBar } from "./ShowcaseSearchBar";

export interface ShowcaseFeedProps {
  className?: string;
}

export function ShowcaseFeed({ className }: ShowcaseFeedProps) {
  const { t } = useTranslation("showcase");
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ShowcaseFiltersState>({
    sortBy: "BUMPED",
  });
  const [page, setPage] = useState(1);
  const [respondingCard, setRespondingCard] =
    useState<ShowcaseCardResponseDto | null>(null);

  const { data: outgoingData } = useMatchmakingControllerFindOutgoing(
    { status: "PENDING", limit: 50 },
    { query: { enabled: !!currentUser } },
  );

  const requestedCardIds = useMemo(() => {
    const list = (
      outgoingData as unknown as {
        data?: Array<{ targetCardId?: string; targetCard?: { id: string } }>;
      }
    )?.data;
    if (!Array.isArray(list)) return new Set<string>();
    return new Set(
      list
        .map((r) => r.targetCard?.id || r.targetCardId)
        .filter(Boolean) as string[],
    );
  }, [outgoingData]);

  const { data, isLoading, isError, refetch } = useShowcaseCatalog({
    search: search.trim() || undefined,
    specialization: filters.specialization,
    level: filters.level,
    language: filters.language,
    isUrgent: filters.isUrgent,
    sortBy: filters.sortBy,
    page,
    limit: 24,
  });

  const cards: ShowcaseCardResponseDto[] = data?.data || [];
  const isFiltered =
    !!search ||
    !!filters.specialization ||
    !!filters.level ||
    !!filters.language ||
    !!filters.isUrgent;

  const handleResetFilters = () => {
    setSearch("");
    setFilters({ sortBy: "BUMPED" });
    setPage(1);
  };

  return (
    <div className={`flex flex-col gap-5 ${className || ""}`}>
      {/* Панель поиска и фильтров */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/60 p-4 shadow-2xs backdrop-blur-xs">
        <ShowcaseSearchBar value={search} onChange={setSearch} />
        <ShowcaseFiltersBar
          filters={filters}
          onChange={(newFilters) => {
            setFilters(newFilters);
            setPage(1);
          }}
          onReset={handleResetFilters}
        />
      </div>

      {/* Лента карточек */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[
            "feed-sk-1",
            "feed-sk-2",
            "feed-sk-3",
            "feed-sk-4",
            "feed-sk-5",
            "feed-sk-6",
          ].map((skKey) => (
            <ShowcaseCardSkeleton key={skKey} />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
          <p className="text-sm font-semibold text-destructive">
            {t("errors.loadError")}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 text-xs text-primary underline underline-offset-4 cursor-pointer"
          >
            {t("errors.tryAgain")}
          </button>
        </div>
      ) : cards.length === 0 ? (
        <ShowcaseEmptyState
          isFiltered={isFiltered}
          onResetFilters={handleResetFilters}
          onCreateCard={() => router.push(paths.partnersNew)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((card: ShowcaseCardResponseDto) => {
            const isOwner = currentUser?.id === card.userId;
            const isRequested = requestedCardIds.has(card.id);

            return (
              <ShowcaseCard
                key={card.id}
                card={card}
                isOwner={isOwner}
                isRequested={isRequested}
                onRespond={() => setRespondingCard(card)}
                onManage={() => router.push(paths.partnersMy)}
              />
            );
          })}
        </div>
      )}

      {/* Диалог отправки заявки на интервью */}
      <SendMatchRequestDialog
        card={respondingCard}
        open={!!respondingCard}
        onOpenChange={(open) => {
          if (!open) setRespondingCard(null);
        }}
        onSuccess={() => {
          refetch();
        }}
      />
    </div>
  );
}
