"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { UserProfileDto } from "@packages/api";
import { Button, Card, Field, Input, Skeleton, Spin } from "@packages/ui";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/entities/user";
import "@/shared/lib/i18n";
import {
  createProfileFormSchema,
  type ProfileFormValues,
  toUpdateProfileDto,
} from "../model/profile-form-schema";
import { useUpdateProfile } from "../model/use-profile-mutations";
import { AvatarUploadField } from "./AvatarUploadField";

function ProfileFields({ user }: { user: UserProfileDto }) {
  const { t } = useTranslation("common");
  const updateProfile = useUpdateProfile();
  const schema = useMemo(() => createProfileFormSchema(t), [t]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: user.displayName ?? "",
      username: user.username ?? "",
      telegramUsername: user.telegramUsername ?? "",
      gitUrl: user.gitUrl ?? "",
    },
  });

  const onSubmit = (values: ProfileFormValues) => {
    updateProfile.mutate(
      { data: toUpdateProfileDto(values) },
      {
        onSuccess: () => {
          reset({
            displayName: values.displayName.trim(),
            username: values.username.trim().toLowerCase(),
            telegramUsername: values.telegramUsername.trim(),
            gitUrl: values.gitUrl.trim(),
          });
        },
      },
    );
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto flex w-full max-w-3xl flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground">
          {t("profile.title")}
        </h1>
        <p className="text-muted-foreground">{t("profile.subtitle")}</p>
      </div>

      <Card>
        <Card.Content className="grid gap-6">
          <AvatarUploadField
            src={user.avatarUrl}
            name={user.displayName}
            email={user.email}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <Field.Label>{t("profile.email")}</Field.Label>
              <Field.Content>
                <Input type="email" value={user.email} disabled readOnly />
              </Field.Content>
            </Field>

            <Field invalid={!!errors.displayName}>
              <Field.Label>{t("profile.displayName")}</Field.Label>
              <Field.Content>
                <Input
                  data-invalid={!!errors.displayName}
                  aria-invalid={!!errors.displayName}
                  {...register("displayName")}
                />
                <Field.Error>{errors.displayName?.message}</Field.Error>
              </Field.Content>
            </Field>

            <Field invalid={!!errors.username}>
              <Field.Label>{t("profile.username")}</Field.Label>
              <Field.Content>
                <Input
                  data-invalid={!!errors.username}
                  aria-invalid={!!errors.username}
                  {...register("username")}
                />
                <Field.Error>{errors.username?.message}</Field.Error>
              </Field.Content>
            </Field>

            <Field invalid={!!errors.telegramUsername}>
              <Field.Label>{t("profile.telegram")}</Field.Label>
              <Field.Content>
                <Input
                  placeholder="@username"
                  data-invalid={!!errors.telegramUsername}
                  aria-invalid={!!errors.telegramUsername}
                  {...register("telegramUsername")}
                />
                <Field.Error>{errors.telegramUsername?.message}</Field.Error>
              </Field.Content>
            </Field>

            <Field invalid={!!errors.gitUrl} className="sm:col-span-2">
              <Field.Label>{t("profile.gitUrl")}</Field.Label>
              <Field.Content>
                <Input
                  placeholder="https://github.com/username"
                  data-invalid={!!errors.gitUrl}
                  aria-invalid={!!errors.gitUrl}
                  {...register("gitUrl")}
                />
                <Field.Error>{errors.gitUrl?.message}</Field.Error>
              </Field.Content>
            </Field>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-5 text-sm">
              {updateProfile.isError ? (
                <p className="text-destructive">{t("profile.saveError")}</p>
              ) : null}
              {updateProfile.isSuccess ? (
                <p className="text-muted-foreground">
                  {t("profile.saveSuccess")}
                </p>
              ) : null}
            </div>
            <Button
              type="submit"
              className="sm:w-auto"
              disabled={!isDirty || updateProfile.isPending}
              aria-busy={updateProfile.isPending}
            >
              {updateProfile.isPending ? (
                <Spin size="sm" variant="current" />
              ) : null}
              {updateProfile.isPending
                ? t("profile.saving")
                : t("actions.save")}
            </Button>
          </div>
        </Card.Content>
      </Card>
    </form>
  );
}

export function UpdateProfileForm() {
  const { t } = useTranslation("common");
  const { data: user, isLoading, isError } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !user) {
    return <p className="text-sm text-destructive">{t("profile.loadError")}</p>;
  }

  return <ProfileFields user={user} />;
}
