"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Dialog } from "@packages/ui";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { ShowcaseCardResponseDto } from "@/entities/showcase-card";
import "@/shared/lib/i18n";
import {
  createShowcaseFormSchema,
  type ShowcaseFormValues,
} from "../model/showcase-form-schema";
import { useShowcaseMutations } from "../model/use-showcase-mutations";
import { ShowcaseCardForm } from "./ShowcaseCardForm";
import { ShowcaseCardLivePreview } from "./ShowcaseCardLivePreview";

export interface EditCardDialogProps {
  card: ShowcaseCardResponseDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditCardDialog({
  card,
  open,
  onOpenChange,
  onSuccess,
}: EditCardDialogProps) {
  const { t } = useTranslation("showcase");
  const { updateCard, isUpdating } = useShowcaseMutations();

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

  const initialValues = useMemo<ShowcaseFormValues>(() => {
    if (!card) {
      return {
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
    }

    return {
      specialization: card.specialization,
      level: card.level,
      language: card.language,
      skills: card.skills || [],
      title: card.title || "",
      bio: card.bio || "",
      scheduleInfo: card.scheduleInfo || "",
      isUrgent: card.isUrgent ?? false,
      autoRenew: card.autoRenew ?? false,
    };
  }, [card]);

  const form = useForm<ShowcaseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
    mode: "onTouched",
  });

  const { reset, watch } = form;
  const watchedValues = watch();

  useEffect(() => {
    if (open && card) {
      reset(initialValues);
    }
  }, [open, card, initialValues, reset]);

  const handleSubmitForm = async (values: ShowcaseFormValues) => {
    if (!card) return;

    await updateCard(card.id, values, {
      onSuccess: () => {
        onOpenChange(false);
        onSuccess?.();
      },
    });
  };

  if (!card) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="w-full sm:max-w-4xl max-w-4xl p-0 overflow-hidden sm:max-h-[90vh] flex flex-col">
        <Dialog.Header className="px-6 pt-6 pb-4 border-b border-border/60">
          <Dialog.Title className="text-xl font-bold">
            {t("form.editTitle")}
          </Dialog.Title>
        </Dialog.Header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            <div className="lg:col-span-7">
              <ShowcaseCardForm form={form} onSubmit={handleSubmitForm} />
            </div>

            <div className="lg:col-span-5 lg:sticky lg:top-0">
              <ShowcaseCardLivePreview
                values={watchedValues}
                user={card.user}
                className="rounded-xl border border-border/60 bg-muted/15 p-4"
              />
            </div>
          </div>
        </div>

        <Dialog.Footer className="m-0 rounded-b-xl px-6 py-4 border-t border-border/60 bg-muted/10 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUpdating}
            onClick={() => onOpenChange(false)}
          >
            {t("actions.cancel")}
          </Button>
          <Button
            type="submit"
            form="showcase-card-form"
            variant="default"
            size="sm"
            disabled={isUpdating}
            className="font-semibold shadow-xs"
          >
            {isUpdating ? t("actions.loading") : t("form.submitSave")}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
