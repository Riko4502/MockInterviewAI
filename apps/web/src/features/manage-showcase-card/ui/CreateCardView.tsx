"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircleIcon, ArrowLeftIcon, InfoIcon } from "@packages/icons";
import { Button, Skeleton } from "@packages/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
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

const defaultValues: ShowcaseFormValues = {
  specialization: "FRONTEND",
  level: "MIDDLE",
  language: "RU",
  skills: [],
  title: "",
  bio: "",
  scheduleInfo: "",
  isUrgent: false,
  autoRenew: false,
};

export function CreateCardView() {
  const { t } = useTranslation("showcase");
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUser();
  const { createCard, isCreating } = useShowcaseMutations();

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
    defaultValues,
    mode: "onTouched",
  });

  useEffect(() => {
    if (user?.targetRole || user?.targetLevel) {
      form.reset((prev) => ({
        ...prev,
        specialization:
          (user.targetRole as ShowcaseFormValues["specialization"]) ||
          prev.specialization,
        level: (user.targetLevel as ShowcaseFormValues["level"]) || prev.level,
      }));
    }
  }, [user?.targetRole, user?.targetLevel, form]);

  const { watch } = form;
  const watchedValues = watch();

  const isProfileIncomplete =
    !isLoading && (!user?.displayName || !user?.username);

  const handleSubmitForm = async (values: ShowcaseFormValues) => {
    await createCard(values, {
      onSuccess: () => {
        router.push(paths.partnersMy);
      },
    });
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto pb-12">
      {/* Навигация назад */}
      <div>
        <Link
          href={paths.partners}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeftIcon className="size-4 transition-transform group-hover:-translate-x-0.5" />
          <span>{t("tabs.catalog")}</span>
        </Link>
      </div>

      {/* Заголовок страницы */}
      <div className="flex flex-col gap-1.5 border-b border-border/60 pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {t("form.title")}
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
          {t("createCardDescription")}
        </p>
      </div>

      {/* Содержимое страницы */}
      {isLoading ? (
        <div
          data-testid="create-card-skeleton"
          className="grid gap-8 lg:grid-cols-12 items-start mt-2"
        >
          <Skeleton className="lg:col-span-7 h-96 rounded-2xl" />
          <Skeleton className="lg:col-span-5 h-72 rounded-2xl" />
        </div>
      ) : isProfileIncomplete ? (
        <div className="flex flex-col items-center justify-center p-10 text-center gap-4 bg-muted/20 border border-dashed border-border rounded-2xl max-w-2xl mx-auto my-8">
          <div className="size-14 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <AlertCircleIcon className="size-7" />
          </div>
          <div className="max-w-md space-y-1.5">
            <h4 className="font-semibold text-foreground text-base">
              {t("form.profileIncompleteWarning")}
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("form.profileIncompleteDescription")}
            </p>
          </div>
          <Button asChild size="default" variant="primary" className="mt-2">
            <Link href={paths.profile}>{t("form.goToProfile")}</Link>
          </Button>
        </div>
      ) : (
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
                  disabled={isCreating}
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
                  disabled={isCreating}
                  className="px-6 font-semibold shadow-xs cursor-pointer"
                >
                  {isCreating ? t("actions.loading") : t("form.submitCreate")}
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
                <span>{t("form.tipsTitle")}</span>
              </h4>
              <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-4 leading-relaxed">
                <li>{t("form.tip1")}</li>
                <li>{t("form.tip2")}</li>
                <li>{t("form.tip3")}</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
