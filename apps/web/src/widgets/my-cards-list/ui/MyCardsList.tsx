"use client";

import { PlusIcon } from "@packages/icons";
import { Button } from "@packages/ui";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type ShowcaseCardResponseDto,
  ShowcaseCardSkeleton,
  useMyShowcaseCards,
} from "@/entities/showcase-card";
import {
  DeleteCardConfirmDialog,
  EditCardDialog,
} from "@/features/manage-showcase-card";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";
import { MyCardItem } from "./MyCardItem";
import { ShowcaseLimitBanner } from "./ShowcaseLimitBanner";

export interface MyCardsListProps {
  className?: string;
}

export function MyCardsList({ className }: MyCardsListProps) {
  const { t } = useTranslation("showcase");
  const { data: rawCards, isLoading, isError, refetch } = useMyShowcaseCards();
  const cards: ShowcaseCardResponseDto[] = Array.isArray(rawCards)
    ? rawCards
    : [];

  const [editingCard, setEditingCard] =
    useState<ShowcaseCardResponseDto | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);

  const activeCardsCount = cards.filter(
    (c: ShowcaseCardResponseDto) => c.status === "ACTIVE",
  ).length;
  const isLimitReached = activeCardsCount >= 5;

  return (
    <div className={`flex flex-col gap-6 ${className || ""}`}>
      {/* Баннер лимита и верхняя панель действий */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <ShowcaseLimitBanner
          activeCount={activeCardsCount}
          maxCount={5}
          className="flex-1"
        />

        {isLimitReached ? (
          <Button
            variant="default"
            size="default"
            disabled
            className="gap-2 font-semibold shadow-xs shrink-0 self-start sm:self-auto"
          >
            <PlusIcon className="size-4" />
            <span>{t("createCard")}</span>
          </Button>
        ) : (
          <Button
            asChild
            variant="default"
            size="default"
            className="gap-2 font-semibold shadow-xs shrink-0 self-start sm:self-auto"
          >
            <Link href={paths.partnersNew}>
              <PlusIcon className="size-4" />
              <span>{t("createCard")}</span>
            </Link>
          </Button>
        )}
      </div>

      {/* Список анкет */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {["my-sk-1", "my-sk-2", "my-sk-3"].map((skKey) => (
            <ShowcaseCardSkeleton key={skKey} />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
          <p className="text-sm font-semibold text-destructive">
            {t("errors.myCardsLoadError")}
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
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 p-12 text-center">
          <h3 className="text-base font-bold text-foreground">
            {t("filters.emptyMyCardsTitle")}
          </h3>
          <p className="mt-1.5 max-w-sm text-xs text-muted-foreground leading-relaxed">
            {t("filters.emptyMyCardsDescription")}
          </p>
          <Button asChild variant="default" size="sm" className="mt-5">
            <Link href={paths.partnersNew}>{t("createCard")}</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((card: ShowcaseCardResponseDto) => (
            <MyCardItem
              key={card.id}
              card={card}
              onEdit={(c: ShowcaseCardResponseDto) => setEditingCard(c)}
              onDelete={(id: string) => setDeletingCardId(id)}
            />
          ))}
        </div>
      )}

      {/* Диалоги */}
      <EditCardDialog
        card={editingCard}
        open={!!editingCard}
        onOpenChange={(open) => {
          if (!open) setEditingCard(null);
        }}
        onSuccess={() => refetch()}
      />

      <DeleteCardConfirmDialog
        cardId={deletingCardId}
        open={!!deletingCardId}
        onOpenChange={(open) => {
          if (!open) setDeletingCardId(null);
        }}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
