"use client";

import {
  createShowcaseCardSchema,
  experienceLevelEnum,
  interviewLanguageEnum,
  specializationEnum,
} from "@packages/dto";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  Input,
  Label,
  Select,
  Textarea,
  useToast,
} from "@packages/ui";
import Link from "next/link";
import { type FormEvent, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HttpError } from "@/shared/api";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";
import { useCreateShowcaseMutation } from "../model/useCreateShowcaseMutation";

export function CreateShowcaseDialog() {
  const { t } = useTranslation("dashboard");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState("");
  const locked = useRef(false);
  const mutation = useCreateShowcaseMutation();
  const toast = useToast();

  function changeOpen(next: boolean) {
    if (locked.current) return;
    setOpen(next);
    if (!next) {
      setErrors({});
      setSubmitError("");
      mutation.reset();
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = createShowcaseCardSchema.safeParse({
      title: String(data.get("title") ?? "").trim() || undefined,
      specialization: data.get("specialization"),
      level: data.get("level"),
      language: data.get("language"),
      skills: String(data.get("skills") ?? "")
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean),
      bio: String(data.get("bio") ?? ""),
      scheduleInfo: String(data.get("scheduleInfo") ?? ""),
      isUrgent: data.get("isUrgent") === "on",
      autoRenew: data.get("autoRenew") === "on",
    });
    setSubmitError("");
    if (!result.success) {
      const nextErrors = Object.fromEntries(
        result.error.issues.map((issue) => [String(issue.path[0]), true]),
      );
      setErrors(nextErrors);
      const field = String(result.error.issues[0]?.path[0]);
      document.getElementById(`${id}-${field}`)?.focus();
      return;
    }
    setErrors({});
    locked.current = true;
    try {
      await mutation.mutateAsync({ data: result.data });
      toast.push({ status: "success", title: t("createShowcase.success") });
      setOpen(false);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : undefined;
      setSubmitError(
        t(
          status === 409
            ? "createShowcase.duplicate"
            : status === 400
              ? "createShowcase.rejected"
              : "createShowcase.failed",
        ),
      );
    } finally {
      locked.current = false;
    }
  }

  const fieldError = (name: string) =>
    errors[name] ? (
      <p id={`${id}-${name}-error`} className="text-sm text-destructive">
        {t("createShowcase.invalid")}
      </p>
    ) : null;
  const fieldProps = (name: string) => ({
    id: `${id}-${name}`,
    name,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `${id}-${name}-error` : undefined,
  });

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger asChild>
        <Button>{t("createShowcase.trigger")}</Button>
      </Dialog.Trigger>
      <Dialog.Content
        className="w-[calc(100vw-2rem)] sm:w-[60vw] sm:max-w-[60vw] max-h-[90dvh] overflow-y-auto"
        showCloseButton={!mutation.isPending}
      >
        <Dialog.Header>
          <Dialog.Title>{t("createShowcase.title")}</Dialog.Title>
          <Dialog.Description>
            {t("createShowcase.description")}
          </Dialog.Description>
        </Dialog.Header>
        <p className="text-sm text-muted-foreground">
          {t("createShowcase.profileHint")}{" "}
          <Link className="underline" href={paths.profile}>
            {t("createShowcase.profileLink")}
          </Link>
        </p>
        <form
          onSubmit={(event) => void submit(event)}
          noValidate
          aria-busy={mutation.isPending}
          className="space-y-4"
        >
          <fieldset
            disabled={mutation.isPending}
            className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`${id}-title`}>
                {t("createShowcase.headline")}
              </Label>
              <Input {...fieldProps("title")} maxLength={100} />
              {fieldError("title")}
            </div>
            <div className="contents">
              <div className="space-y-2">
                <Label htmlFor={`${id}-specialization`}>
                  {t("createShowcase.specialization")}
                </Label>
                <Select name="specialization" disabled={mutation.isPending}>
                  <Select.Trigger
                    {...fieldProps("specialization")}
                    className="w-full"
                  >
                    <Select.Value placeholder={t("createShowcase.choose")} />
                  </Select.Trigger>
                  <Select.Content>
                    {specializationEnum.options.map((value) => (
                      <Select.Item key={value} value={value}>
                        {t(`specializations.${value}`)}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
                {fieldError("specialization")}
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-level`}>
                  {t("createShowcase.level")}
                </Label>
                <Select name="level" disabled={mutation.isPending}>
                  <Select.Trigger {...fieldProps("level")} className="w-full">
                    <Select.Value placeholder={t("createShowcase.choose")} />
                  </Select.Trigger>
                  <Select.Content>
                    {experienceLevelEnum.options.map((value) => (
                      <Select.Item key={value} value={value}>
                        {t(`levels.${value}`)}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
                {fieldError("level")}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-language`}>
                {t("createShowcase.language")}
              </Label>
              <Select
                name="language"
                defaultValue="RU"
                disabled={mutation.isPending}
              >
                <Select.Trigger {...fieldProps("language")} className="w-full">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {interviewLanguageEnum.options.map((value) => (
                    <Select.Item key={value} value={value}>
                      {t(`createShowcase.languages.${value}`)}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
              {fieldError("language")}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-skills`}>
                {t("createShowcase.skills")}
              </Label>
              <Input
                {...fieldProps("skills")}
                placeholder="React, TypeScript"
              />
              <p className="text-sm text-muted-foreground">
                {t("createShowcase.skillsHint")}
              </p>
              {fieldError("skills")}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-bio`}>{t("createShowcase.bio")}</Label>
              <Textarea
                {...fieldProps("bio")}
                maxLength={500}
                className="min-h-20"
              />
              {fieldError("bio")}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-scheduleInfo`}>
                {t("createShowcase.schedule")}
              </Label>
              <Textarea
                {...fieldProps("scheduleInfo")}
                maxLength={300}
                className="min-h-20"
              />
              {fieldError("scheduleInfo")}
            </div>
            <div className="flex items-center gap-2 sm:col-span-1">
              <Checkbox
                id={`${id}-urgent`}
                name="isUrgent"
                disabled={mutation.isPending}
              />
              <Label htmlFor={`${id}-urgent`}>
                {t("createShowcase.urgent")}
              </Label>
            </div>
            <div className="flex items-center gap-2 sm:col-span-1">
              <Checkbox
                id={`${id}-renew`}
                name="autoRenew"
                disabled={mutation.isPending}
              />
              <Label htmlFor={`${id}-renew`}>
                {t("createShowcase.autoRenew")}
              </Label>
            </div>
          </fieldset>
          {submitError && (
            <Alert variant="destructive">
              <Alert.Description>{submitError}</Alert.Description>
            </Alert>
          )}
          <Dialog.Footer>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => changeOpen(false)}
            >
              {t("createShowcase.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {t(
                mutation.isPending
                  ? "createShowcase.publishing"
                  : "createShowcase.publish",
              )}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}
