"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { UserProfileDto } from "@packages/api";
import { localeLabels, locales } from "@packages/dto";
import { GlobeIcon, MoonIcon, SlidersIcon, SunIcon } from "@packages/icons";
import {
  Button,
  Card,
  Field,
  Input,
  Select,
  Skeleton,
  Spin,
  useToast,
} from "@packages/ui";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
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
  const toast = useToast();
  const schema = useMemo(() => createProfileFormSchema(t), [t]);
  const isSaving = updateProfile.isPending;

  const defaultValues = useMemo<ProfileFormValues>(
    () => ({
      displayName: user.displayName ?? "",
      username: user.username ?? "",
      telegramUsername: user.telegramUsername ?? "",
      gitUrl: user.gitUrl ?? "",
      theme: user.theme ?? "dark",
      locale: user.locale ?? "ru",
    }),
    [user],
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues, { keepDirtyValues: true });
  }, [defaultValues, reset]);

  const onSubmit = (values: ProfileFormValues) => {
    const data = toUpdateProfileDto(values, dirtyFields);

    if (Object.keys(data).length === 0) {
      toast.push({
        status: "success",
        title: t("profile.saveSuccess"),
      });
      return;
    }

    updateProfile.mutate(
      { data },
      {
        onSuccess: (updatedUser) => {
          reset({
            displayName: updatedUser.displayName ?? "",
            username: updatedUser.username ?? "",
            telegramUsername: updatedUser.telegramUsername ?? "",
            gitUrl: updatedUser.gitUrl ?? "",
            theme: updatedUser.theme ?? "dark",
            locale: updatedUser.locale ?? "ru",
          });
          toast.push({
            status: "success",
            title: t("profile.saveSuccess"),
          });
        },
        onError: () => {
          toast.push({
            status: "error",
            title: t("profile.saveError"),
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
                  disabled={isSaving}
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
                  disabled={isSaving}
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
                  disabled={isSaving}
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
                  disabled={isSaving}
                  {...register("gitUrl")}
                />
                <Field.Error>{errors.gitUrl?.message}</Field.Error>
              </Field.Content>
            </Field>
          </div>

          <div className="border-t border-border pt-4">
            <h2 className="text-base font-semibold text-foreground">
              {t("profile.preferencesTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("profile.preferencesSubtitle")}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <Field.Label>{t("profile.theme")}</Field.Label>
              <Field.Content>
                <Controller
                  control={control}
                  name="theme"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isSaving}
                    >
                      <Select.Trigger className="w-full">
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="light">
                          <span className="flex items-center gap-2">
                            <SunIcon size={16} />
                            {t("profile.themeLight")}
                          </span>
                        </Select.Item>
                        <Select.Item value="dark">
                          <span className="flex items-center gap-2">
                            <MoonIcon size={16} />
                            {t("profile.themeDark")}
                          </span>
                        </Select.Item>
                        <Select.Item value="system">
                          <span className="flex items-center gap-2">
                            <SlidersIcon size={16} />
                            {t("profile.themeSystem")}
                          </span>
                        </Select.Item>
                      </Select.Content>
                    </Select>
                  )}
                />
              </Field.Content>
            </Field>

            <Field>
              <Field.Label>{t("profile.language")}</Field.Label>
              <Field.Content>
                <Controller
                  control={control}
                  name="locale"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isSaving}
                    >
                      <Select.Trigger className="w-full">
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        {locales.map((loc) => (
                          <Select.Item key={loc} value={loc}>
                            <span className="flex items-center gap-2">
                              <GlobeIcon size={16} />
                              {localeLabels[loc]}
                            </span>
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  )}
                />
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
              disabled={!isDirty || isSaving}
              aria-busy={isSaving}
            >
              {isSaving ? <Spin size="sm" variant="current" /> : null}
              {isSaving ? t("profile.saving") : t("actions.save")}
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
