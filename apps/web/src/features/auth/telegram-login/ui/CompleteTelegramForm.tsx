"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { telegramCompleteSchema } from "@packages/dto";
import { Button, Field, Input, Typography } from "@packages/ui";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { HttpError } from "@/shared/api";
import { getErrorMessage } from "../../lib/getErrorMessage";
import { useCompleteTelegram } from "../model/useCompleteTelegram";

/** Из общей схемы API берём только поле email: токен форма получает через props. */
const emailSchema = telegramCompleteSchema.pick({ email: true });

interface CompleteTelegramFormProps {
  onboardingToken: string;
}

/** Форма ввода email для завершения регистрации через Telegram. */
export function CompleteTelegramForm({
  onboardingToken,
}: CompleteTelegramFormProps) {
  const { t } = useTranslation("auth");
  const completeMutation = useCompleteTelegram();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(emailSchema),
  });

  const onSubmit = handleSubmit(({ email }) => {
    completeMutation.mutate({ data: { onboardingToken, email } });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Typography.Muted>{t("completeTelegram.description")}</Typography.Muted>

      <Field invalid={!!errors.email}>
        <Field.Label>{t("fields.email.label")}</Field.Label>
        <Field.Content>
          <Input
            type="email"
            autoComplete="email"
            placeholder={t("fields.email.placeholder")}
            data-invalid={!!errors.email}
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          <Field.Error>{errors.email?.message}</Field.Error>
        </Field.Content>
      </Field>

      <Button
        type="submit"
        size="lg"
        disabled={completeMutation.isPending}
        className="w-full mt-4"
      >
        {completeMutation.isPending
          ? t("completeTelegram.submitting")
          : t("completeTelegram.submit")}
      </Button>

      {completeMutation.isError && (
        <Typography.P className="text-sm text-destructive">
          {completeMutation.error instanceof HttpError
            ? getErrorMessage(
                completeMutation.error,
                t("completeTelegram.error"),
              )
            : t("oauth.telegram.networkError")}
        </Typography.P>
      )}
    </form>
  );
}
