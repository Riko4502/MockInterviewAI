"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftIcon, InfoIcon } from "@packages/icons";
import { Button } from "@packages/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  type ShowcaseCardResponseDto,
  useMyShowcaseCards,
} from "@/entities/showcase-card";
import { useCurrentUser } from "@/entities/user";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";
import {
  createShowcaseFormSchema,
  type ShowcaseFormValues,
} from "../model/showcase-form-schema";
import { useShowcaseMutations } from "../model/use-showcase-mutations";
import { ShowcaseCardForm } from "./ShowcaseCardForm";
import { ShowcaseCardLivePreview } from "./ShowcaseCardLivePreview";

export interface EditCardViewProps {
  cardId: string;
}

export function EditCardView({ cardId }: EditCardViewProps) {
  const { t } = useTranslation("showcase");
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const { updateCard, isUpdating } = useShowcaseMutations();

  const { data: rawCards, isLoading } = useMyShowcaseCards();
  const cards: ShowcaseCardResponseDto[] = Array.isArray(rawCards)
    ? rawCards
    : [];
  const card = cards.find((c) => c.id === cardId);

  const schema = useMemo(
    () =>
      createShowcaseFormSchema(
        t as unknown as (
          key: string,
          options?: Record<string, unknown>,
        ) => string,
      ),
    [t],
  );

  const form = useForm<ShowcaseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      specialization: "FRONTEND",
      level: "MIDDLE",
      language: "RU",
      skills: [],
      title: "",
      bio: "",
      scheduleInfo: "",
      isUrgent: false,
      autoRenew: false,
    },
    mode: "onTouched",
  });

  const { reset, watch } = form;
  const watchedValues = watch();

  // Заполняем форму данными карточки после её загрузки
  useEffect(() => {
    if (card) {
      reset({
        specialization: card.specialization,
        level: card.level,
        language: card.language,
        skills: card.skills || [],
        title: card.title || "",
        bio: card.bio || "",
        scheduleInfo: card.scheduleInfo || "",
        isUrgent: card.isUrgent ?? false,
        autoRenew: card.autoRenew ?? false,
      });
    }
  }, [card, reset]);

  const handleSubmitForm = async (values: ShowcaseFormValues) => {
    await updateCard(cardId, values, {
      onSuccess: () => {
        router.push(paths.partnersMy);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto pb-12">
        <div className="h-6 w-32 bg-muted/40 animate-pulse rounded-md" />
        <div className="grid gap-8 lg:grid-cols-12 items-start mt-4">
          <div className="lg:col-span-7 h-96 bg-muted/30 animate-pulse rounded-2xl" />
          <div className="lg:col-span-5 h-72 bg-muted/30 animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center gap-4 bg-muted/20 border border-dashed border-border rounded-2xl max-w-xl mx-auto my-12">
        <h3 className="text-lg font-bold text-foreground">
          {t("form.notFoundTitle")}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("form.notFoundDesc")}
        </p>
        <Button asChild size="default" variant="default" className="mt-2">
          <Link href={paths.partnersMy}>{t("form.backToMyCards")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto pb-12">
      {/* Навигация назад */}
      <div>
        <Link
          href={paths.partnersMy}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeftIcon className="size-4 transition-transform group-hover:-translate-x-0.5" />
          <span>{t("tabs.myCards")}</span>
        </Link>
      </div>

      {/* Заголовок страницы */}
      <div className="flex flex-col gap-1.5 border-b border-border/60 pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {t("form.editTitle")}
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
          {t("form.editDescription")}
        </p>
      </div>

      {/* Содержимое страницы */}
      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* Левая колонка: Форма ввода данных */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="rounded-2xl border border-border/70 bg-card p-6 sm:p-7 shadow-xs">
            <ShowcaseCardForm form={form} onSubmit={handleSubmitForm} />

            {/* Панель кнопок формы */}
            <div className="mt-8 pt-5 border-t border-border/60 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                size="default"
                disabled={isUpdating}
                onClick={() => router.back()}
                className="px-5 cursor-pointer"
              >
                {t("actions.cancel")}
              </Button>
              <Button
                type="submit"
                form="showcase-card-form"
                variant="default"
                size="default"
                disabled={isUpdating}
                className="px-6 font-semibold shadow-xs cursor-pointer"
              >
                {isUpdating ? t("actions.loading") : t("form.submitSave")}
              </Button>
            </div>
          </div>
        </div>

        {/* Правая колонка: Live Preview и подсказки */}
        <div className="lg:col-span-5 lg:sticky lg:top-6 flex flex-col gap-5">
          <ShowcaseCardLivePreview
            values={watchedValues}
            user={user}
            className="rounded-2xl border border-border/70 bg-card/60 p-5 shadow-xs backdrop-blur-xs"
          />

          {/* Карточка полезных советов */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-5 space-y-3">
            <h4 className="font-semibold text-foreground text-xs flex items-center gap-1.5 uppercase tracking-wider">
              <InfoIcon className="size-3.5 text-primary" />
              <span>{t("form.tipsEditTitle")}</span>
            </h4>
            <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-4 leading-relaxed">
              <li>{t("form.editTip1")}</li>
              <li>{t("form.editTip2")}</li>
              <li>{t("form.editTip3")}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
