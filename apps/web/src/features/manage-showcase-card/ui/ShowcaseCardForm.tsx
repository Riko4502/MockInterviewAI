"use client";

import {
  type ExperienceLevel,
  experienceLevelEnum,
  type InterviewLanguage,
  interviewLanguageEnum,
  type Specialization,
  specializationEnum,
} from "@packages/dto";
import { PlusIcon } from "@packages/icons";
import { Field, Input, Select, Switch, TagInput, Textarea } from "@packages/ui";
import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import type { ShowcaseFormValues } from "../model/showcase-form-schema";
import { useSkillSuggestions } from "../model/use-skill-suggestions";

export interface ShowcaseCardFormProps {
  form: UseFormReturn<ShowcaseFormValues>;
  onSubmit: (values: ShowcaseFormValues) => void;
  className?: string;
}

export function ShowcaseCardForm({
  form,
  onSubmit,
  className,
}: ShowcaseCardFormProps) {
  const { t } = useTranslation("showcase");
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const currentSpecialization = watch("specialization");
  const currentSkills = watch("skills") || [];
  const currentBio = watch("bio") || "";
  const currentSchedule = watch("scheduleInfo") || "";

  const popularSkills = useSkillSuggestions(currentSpecialization);

  const handleAddSuggestedSkill = (skill: string) => {
    if (!currentSkills.includes(skill) && currentSkills.length < 20) {
      setValue("skills", [...currentSkills, skill], {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  };

  return (
    <form
      id="showcase-card-form"
      onSubmit={handleSubmit(onSubmit)}
      className={className}
      noValidate
    >
      <div className="flex flex-col gap-4">
        {/* Строка 1: Специализация и Уровень */}
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field invalid={!!errors.specialization}>
            <Field.Label>{t("form.specializationLabel")}</Field.Label>
            <Field.Content>
              <Controller
                control={control}
                name="specialization"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val: string) =>
                      field.onChange(val as Specialization)
                    }
                  >
                    <Select.Trigger className="w-full">
                      <Select.Value
                        placeholder={t("form.specializationPlaceholder")}
                      />
                    </Select.Trigger>
                    <Select.Content>
                      {specializationEnum.options.map((spec) => (
                        <Select.Item key={spec} value={spec}>
                          {t(`specializations.${spec}`)}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                )}
              />
              <Field.Error>{errors.specialization?.message}</Field.Error>
            </Field.Content>
          </Field>

          <Field invalid={!!errors.level}>
            <Field.Label>{t("form.levelLabel")}</Field.Label>
            <Field.Content>
              <Controller
                control={control}
                name="level"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val: string) =>
                      field.onChange(val as ExperienceLevel)
                    }
                  >
                    <Select.Trigger className="w-full">
                      <Select.Value placeholder={t("form.levelPlaceholder")} />
                    </Select.Trigger>
                    <Select.Content>
                      {experienceLevelEnum.options.map((lvl) => (
                        <Select.Item key={lvl} value={lvl}>
                          {t(`levels.${lvl}`)}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                )}
              />
              <Field.Error>{errors.level?.message}</Field.Error>
            </Field.Content>
          </Field>
        </div>

        {/* Строка 2: Язык собеседования */}
        <Field invalid={!!errors.language}>
          <Field.Label>{t("form.languageLabel")}</Field.Label>
          <Field.Content>
            <Controller
              control={control}
              name="language"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(val: string) =>
                    field.onChange(val as InterviewLanguage)
                  }
                >
                  <Select.Trigger className="w-full">
                    <Select.Value placeholder={t("form.languagePlaceholder")} />
                  </Select.Trigger>
                  <Select.Content>
                    {interviewLanguageEnum.options.map((lang) => (
                      <Select.Item key={lang} value={lang}>
                        {t(`languages.${lang}`)}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              )}
            />
            <Field.Error>{errors.language?.message}</Field.Error>
          </Field.Content>
        </Field>

        {/* Навыки (TagInput + подсказки) */}
        <Field invalid={!!errors.skills}>
          <Field.Label className="flex items-center justify-between">
            <span>{t("form.skillsLabel")}</span>
            <span className="text-xs text-muted-foreground font-normal">
              {currentSkills.length}/20
            </span>
          </Field.Label>
          <Field.Content>
            <Controller
              control={control}
              name="skills"
              render={({ field }) => (
                <TagInput
                  value={field.value}
                  onChange={(tags) => field.onChange(tags)}
                  placeholder={t("form.skillsPlaceholder")}
                  maxTags={20}
                  showCount={false}
                  invalid={!!errors.skills}
                />
              )}
            />
            <Field.Error>{errors.skills?.message}</Field.Error>
          </Field.Content>

          {/* Быстрые подсказки навыков по выбранному направлению */}
          {popularSkills.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-xs text-muted-foreground mr-0.5">
                {t("form.popularSkills")}
              </span>
              {popularSkills.map((skill) => {
                const isSelected = currentSkills.includes(skill);
                if (isSelected) return null;

                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => handleAddSuggestedSkill(skill)}
                    className="inline-flex items-center gap-1 rounded-md bg-muted/60 hover:bg-muted px-2 py-0.5 text-xs text-foreground/80 hover:text-foreground border border-border/40 transition-colors"
                  >
                    <PlusIcon className="size-2.5" />
                    <span>{skill}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Field>

        {/* Заголовок анкеты */}
        <Field invalid={!!errors.title}>
          <Field.Label>{t("form.cardTitleLabel")}</Field.Label>
          <Field.Content>
            <Input
              placeholder={t("form.cardTitlePlaceholder")}
              maxLength={100}
              {...register("title")}
            />
            <Field.Error>{errors.title?.message}</Field.Error>
          </Field.Content>
        </Field>

        {/* О себе / Bio */}
        <Field invalid={!!errors.bio}>
          <Field.Label className="flex items-center justify-between">
            <span>{t("form.bioLabel")}</span>
            <span className="text-xs text-muted-foreground font-normal">
              {currentBio.length}/500
            </span>
          </Field.Label>
          <Field.Content>
            <Textarea
              placeholder={t("form.bioPlaceholder")}
              maxLength={500}
              className="min-h-[85px] text-xs leading-relaxed"
              {...register("bio")}
            />
            <Field.Error>{errors.bio?.message}</Field.Error>
          </Field.Content>
        </Field>

        {/* Расписание / доступное время */}
        <Field invalid={!!errors.scheduleInfo}>
          <Field.Label className="flex items-center justify-between">
            <span>{t("form.scheduleLabel")}</span>
            <span className="text-xs text-muted-foreground font-normal">
              {currentSchedule.length}/300
            </span>
          </Field.Label>
          <Field.Content>
            <Input
              placeholder={t("form.schedulePlaceholder")}
              maxLength={300}
              {...register("scheduleInfo")}
            />
            <Field.Error>{errors.scheduleInfo?.message}</Field.Error>
          </Field.Content>
        </Field>

        {/* Переключатели isUrgent и autoRenew */}
        <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/20 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <label
                htmlFor="switch-urgent"
                className="text-xs font-semibold text-foreground cursor-pointer flex items-center gap-1.5"
              >
                <span>⚡ {t("form.urgentLabel")}</span>
              </label>
              <p className="text-[11px] text-muted-foreground">
                {t("form.urgentDescription")}
              </p>
            </div>
            <Controller
              control={control}
              name="isUrgent"
              render={({ field }) => (
                <Switch
                  id="switch-urgent"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          <div className="border-t border-border/40 pt-2.5 flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <label
                htmlFor="switch-auto-renew"
                className="text-xs font-semibold text-foreground cursor-pointer"
              >
                {t("form.autoRenewLabel")}
              </label>
              <p className="text-[11px] text-muted-foreground">
                {t("form.autoRenewDescription")}
              </p>
            </div>
            <Controller
              control={control}
              name="autoRenew"
              render={({ field }) => (
                <Switch
                  id="switch-auto-renew"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
        </div>
      </div>
    </form>
  );
}
