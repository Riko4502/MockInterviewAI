"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircleIcon } from "@packages/icons";
import { Button, Dialog } from "@packages/ui";
import Link from "next/link";
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

export interface CreateCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

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

export function CreateCardDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateCardDialogProps) {
  const { t } = useTranslation("showcase");
  const { data: user } = useCurrentUser();
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

  const { reset, watch } = form;
  const watchedValues = watch();

  useEffect(() => {
    if (open) {
      reset(defaultValues);
    }
  }, [open, reset]);

  const isProfileIncomplete = !user?.displayName || !user?.username;

  const handleSubmitForm = async (values: ShowcaseFormValues) => {
    await createCard(values, {
      onSuccess: () => {
        onOpenChange(false);
        onSuccess?.();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="w-full sm:max-w-4xl max-w-4xl p-0 overflow-hidden sm:max-h-[90vh] flex flex-col">
        {/* Заголовок модального окна */}
        <Dialog.Header className="px-6 pt-6 pb-4 border-b border-border/60">
          <Dialog.Title className="text-xl font-bold">
            {t("form.title")}
          </Dialog.Title>
          <Dialog.Description className="text-xs text-muted-foreground mt-1">
            {t("createCardDescription")}
          </Dialog.Description>
        </Dialog.Header>

        {/* Тело модального окна */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isProfileIncomplete ? (
            <div className="flex flex-col items-center justify-center p-8 text-center gap-4 bg-muted/20 border border-dashed border-border rounded-xl">
              <div className="size-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <AlertCircleIcon className="size-6" />
              </div>
              <div className="max-w-md space-y-1">
                <h4 className="font-semibold text-foreground text-sm">
                  {t("form.profileIncompleteWarning")}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {t("form.profileIncompleteDescription")}
                </p>
              </div>
              <Button asChild size="sm" variant="primary">
                <Link href={paths.profile} onClick={() => onOpenChange(false)}>
                  {t("form.goToProfile")}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-12 items-start">
              {/* Левая колонка: Форма ввода */}
              <div className="lg:col-span-7">
                <ShowcaseCardForm form={form} onSubmit={handleSubmitForm} />
              </div>

              {/* Правая колонка: Live Preview */}
              <div className="lg:col-span-5 lg:sticky lg:top-0">
                <ShowcaseCardLivePreview
                  values={watchedValues}
                  user={user}
                  className="rounded-xl border border-border/60 bg-muted/15 p-4"
                />
              </div>
            </div>
          )}
        </div>

        {/* Футер с действиями */}
        {!isProfileIncomplete && (
          <Dialog.Footer className="m-0 rounded-b-xl px-6 py-4 border-t border-border/60 bg-muted/10 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isCreating}
              onClick={() => onOpenChange(false)}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              type="submit"
              form="showcase-card-form"
              variant="default"
              size="sm"
              disabled={isCreating}
              className="font-semibold shadow-xs"
            >
              {isCreating ? t("actions.loading") : t("form.submitCreate")}
            </Button>
          </Dialog.Footer>
        )}
      </Dialog.Content>
    </Dialog>
  );
}
