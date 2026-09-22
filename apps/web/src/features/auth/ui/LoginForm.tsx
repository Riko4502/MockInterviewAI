"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthControllerLogin } from "@packages/api";
import { loginSchema } from "@packages/dto";
import { Button, Field, Input, Typography } from "@packages/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useSession } from "@/entities/session";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";
import { getErrorMessage } from "../lib/getErrorMessage";
import type { LoginFormValues } from "../lib/schemas";

import { GithubLoginButton } from "./GithubLoginButton";

export function LoginForm() {
  const router = useRouter();
  const { t } = useTranslation("auth");
  const { startSession } = useSession();

  const loginMutation = useAuthControllerLogin({
    mutation: {
      onSuccess: (data) => {
        startSession(data.accessToken);
        router.replace(paths.dashboard);
      },
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate({ data });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field invalid={!!errors.email}>
        <Field.Label>{t("fields.email.label")}</Field.Label>
        <Field.Content>
          <Input
            type="email"
            placeholder={t("fields.email.placeholder")}
            data-invalid={!!errors.email}
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          <Field.Error>{errors.email?.message}</Field.Error>
        </Field.Content>
      </Field>

      <Field invalid={!!errors.password}>
        <Field.Label>{t("fields.password.label")}</Field.Label>
        <Field.Content>
          <Input
            type="password"
            placeholder={t("fields.password.placeholder")}
            data-invalid={!!errors.password}
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          <Field.Error>{errors.password?.message}</Field.Error>
        </Field.Content>
      </Field>

      <Button
        type="submit"
        size="lg"
        disabled={loginMutation.isPending}
        className="w-full mt-4"
      >
        {loginMutation.isPending ? t("login.submitting") : t("login.submit")}
      </Button>

      <GithubLoginButton />

      {loginMutation.isError && (
        <Typography.P className="text-sm text-destructive">
          {getErrorMessage(loginMutation.error, t("login.error"))}
        </Typography.P>
      )}
      <Link
        href={paths.forgotPassword}
        className="text-sm text-center text-muted-foreground hover:text-foreground hover:underline"
      >
        {t("login.forgotPasswordLink")}
      </Link>
    </form>
  );
}
