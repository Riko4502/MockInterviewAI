"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircleIcon } from "@packages/icons";
import { Button, Dialog, Skeleton } from "@packages/ui";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
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
  slots: [],
};

export interface CreateCardDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  onSuccess?: () => void;
}

export function CreateCardDialog({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  trigger,
  onSuccess,
}: CreateCardDialogProps) {
  const { t } = useTranslation("showcase");
  const { data: user, isLoading } = useCurrentUser();
  const { createCard, isCreating } = useShowcaseMutations();

  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const authorTimezone = user?.timezone || "UTC";

  const handleOpenChange = (next: boolean) => {
    if (isCreating) return;
    if (!isControlled) {
      setInternalOpen(next);
    }
    setControlledOpen?.(next);
  };

  const schema = useMemo(
    () =>
      createShowcaseFormSchema(
        t as unknown as (
          key: string,
          options?: Record<string, unknown>,
        ) => string,
        authorTimezone,
      ),
    [t, authorTimezone],
  );

  const form = useForm<ShowcaseFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onTouched",
  });

  const { watch, reset } = form;
  const watchedValues = watch();

  useEffect(() => {
    if (!isOpen || !user) return;

    if (user.targetRole || user.targetLevel) {
      reset((prev) => ({
        ...prev,
        specialization: user?.targetRole || prev.specialization,
        level: user?.targetLevel || prev.level,
      }));
    }
  }, [isOpen, user, reset]);

  const isProfileIncomplete =
    !isLoading && (!user?.displayName || !user?.username);

  const handleSubmitForm = async (values: ShowcaseFormValues) => {
    await createCard(values, {
      onSuccess: () => {
        handleOpenChange(false);
        reset(defaultValues);
        onSuccess?.();
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {trigger ? (
        <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      ) : !isControlled ? (
        <Dialog.Trigger asChild>
          <Button variant="default">{t("form.submitCreate")}</Button>
        </Dialog.Trigger>
      ) : null}

      <Dialog.Content className="w-[calc(100vw-2rem)] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <Dialog.Header>
          <Dialog.Title className="text-xl font-bold">
            {t("form.title")}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">
            {t("createCardDescription")}
          </Dialog.Description>
        </Dialog.Header>

        {isLoading ? (
          <div
            data-testid="create-card-dialog-skeleton"
            className="grid gap-6 lg:grid-cols-12 py-4"
          >
            <Skeleton className="lg:col-span-7 h-80 rounded-2xl" />
            <Skeleton className="lg:col-span-5 h-64 rounded-2xl" />
          </div>
        ) : isProfileIncomplete ? (
          <div className="flex flex-col items-center justify-center p-8 text-center gap-3 bg-muted/20 border border-dashed border-border rounded-2xl my-4">
            <div className="size-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <AlertCircleIcon className="size-6" />
            </div>
            <div className="max-w-md space-y-1">
              <h4 className="font-semibold text-foreground text-base">
                {t("form.profileIncompleteWarning")}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("form.profileIncompleteDescription")}
              </p>
            </div>
            <Button asChild size="default" variant="default" className="mt-2">
              <Link href={paths.profile}>{t("form.goToProfile")}</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-12 items-start py-2">
              {/* Левая колонка: Форма ввода данных */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <ShowcaseCardForm
                  form={form}
                  onSubmit={handleSubmitForm}
                  authorTimezone={authorTimezone}
                />
              </div>

              {/* Правая колонка: Live Preview */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <ShowcaseCardLivePreview
                  values={watchedValues}
                  user={user}
                  authorTimezone={authorTimezone}
                  className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-xs"
                />
              </div>
            </div>

            <Dialog.Footer className="mt-4 pt-4 border-t border-border/60 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={isCreating}
                onClick={() => handleOpenChange(false)}
                className="cursor-pointer"
              >
                {t("actions.cancel")}
              </Button>
              <Button
                type="submit"
                form="showcase-card-form"
                variant="default"
                disabled={isCreating}
                className="font-semibold shadow-xs cursor-pointer"
              >
                {isCreating ? t("actions.loading") : t("form.submitCreate")}
              </Button>
            </Dialog.Footer>
          </>
        )}
      </Dialog.Content>
    </Dialog>
  );
}
