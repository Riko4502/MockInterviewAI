"use client";

import { useMatchmakingControllerFindOutgoing } from "@packages/api";
import { Pagination } from "@packages/ui";
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
    { limit: 50 },
    { query: { enabled: !!currentUser } },
  );

  const {
    pendingCardIds,
    matchedCardIds,
    matchedCardSessions,
    matchedCardSessionStatuses,
  } = useMemo(() => {
    const list = outgoingData?.data;
    if (!Array.isArray(list)) {
      return {
        pendingCardIds: new Set<string>(),
        matchedCardIds: new Set<string>(),
        matchedCardSessions: new Map<string, string>(),
        matchedCardSessionStatuses: new Map<string, string>(),
      };
    }

    const pending = new Set<string>();
    const matched = new Set<string>();
    const sessions = new Map<string, string>();
    const statuses = new Map<string, string>();

    for (const r of list) {
      const cardId = r.targetCard?.id;
      if (!cardId) continue;
      if (r.status === "PENDING") {
        pending.add(cardId);
      } else if (r.status === "ACCEPTED") {
        matched.add(cardId);
        if (r.sessionId) {
          sessions.set(cardId, r.sessionId);
        }
        if (r.sessionStatus) {
          statuses.set(cardId, r.sessionStatus);
        }
      }
    }

    return {
      pendingCardIds: pending,
      matchedCardIds: matched,
      matchedCardSessions: sessions,
      matchedCardSessionStatuses: statuses,
    };
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
        <ShowcaseSearchBar
          value={search}
          onChange={(newSearch) => {
            setSearch(newSearch);
            setPage(1);
          }}
        />
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
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {cards.map((card: ShowcaseCardResponseDto) => {
              const isOwner = currentUser?.id === card.userId;
              const isRequested = pendingCardIds.has(card.id);
              const isMatched = matchedCardIds.has(card.id);

              return (
                <ShowcaseCard
                  key={card.id}
                  card={card}
                  isOwner={isOwner}
                  isRequested={isRequested}
                  isMatched={isMatched}
                  matchedSessionId={matchedCardSessions.get(card.id)}
                  matchedSessionStatus={matchedCardSessionStatuses.get(card.id)}
                  onRespond={() => setRespondingCard(card)}
                  onManage={() => router.push(paths.partnersMy)}
                />
              );
            })}
          </div>

          {/* Пагинация каталога */}
          {data?.meta && (data.meta.hasPrevPage || data.meta.hasNextPage) && (
            <Pagination
              aria-label={t("pagination.label")}
              className="mt-2 justify-center"
            >
              <Pagination.Content>
                <Pagination.Item>
                  <Pagination.Previous
                    href="#"
                    label={t("pagination.previous")}
                    aria-disabled={!data.meta.hasPrevPage}
                    tabIndex={!data.meta.hasPrevPage ? -1 : 0}
                    className={
                      !data.meta.hasPrevPage
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      if (data.meta.hasPrevPage) {
                        setPage((prev) => Math.max(1, prev - 1));
                      }
                    }}
                  />
                </Pagination.Item>

                <Pagination.Item>
                  <span className="px-3 text-xs text-muted-foreground font-medium select-none">
                    {t("pagination.page", {
                      page: data.meta.page,
                      totalPages: data.meta.totalPages,
                    })}
                  </span>
                </Pagination.Item>

                <Pagination.Item>
                  <Pagination.Next
                    href="#"
                    label={t("pagination.next")}
                    aria-disabled={!data.meta.hasNextPage}
                    tabIndex={!data.meta.hasNextPage ? -1 : 0}
                    className={
                      !data.meta.hasNextPage
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      if (data.meta.hasNextPage) {
                        setPage((prev) => prev + 1);
                      }
                    }}
                  />
                </Pagination.Item>
              </Pagination.Content>
            </Pagination>
          )}
        </>
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
