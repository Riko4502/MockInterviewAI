"use client";

import {
  getDashboardControllerGetReadinessQueryKey,
  getProfileControllerGetMyProfileQueryKey,
  useProfileControllerCompleteOnboarding,
} from "@packages/api";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "@packages/icons";
import {
  Button,
  Logo,
  Progress,
  Spin,
  ThemeToggle,
  useToast,
} from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/entities/user";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";
import {
  getInitialOnboardingState,
  type OnboardingLevel,
  type OnboardingRole,
  type OnboardingState,
  type PracticeFormatId,
  type TargetCompanyId,
  type TimelineId,
} from "../model/types";
import { StepFormat } from "./steps/StepFormat";
import { StepRole } from "./steps/StepRole";
import { StepTarget } from "./steps/StepTarget";

const TOTAL_STEPS = 3;

export function OnboardingWizard() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: user, isLoading } = useCurrentUser();
  const completeMutation = useProfileControllerCompleteOnboarding();

  const [step, setStep] = useState<number>(1);
  const [state, setState] = useState<OnboardingState>(() =>
    getInitialOnboardingState(user),
  );
  const [isDirty, setIsDirty] = useState(false);

  // Sync state once user profile is loaded if user hasn't made manual edits yet
  useEffect(() => {
    if (user && !isDirty) {
      setState(getInitialOnboardingState(user));
    }
  }, [user, isDirty]);

  const handleSelectRole = (role: OnboardingRole) => {
    setIsDirty(true);
    setState((prev) => ({ ...prev, role }));
  };

  const handleSelectLevel = (level: OnboardingLevel) => {
    setIsDirty(true);
    setState((prev) => ({ ...prev, level }));
  };

  const handleToggleCompany = (company: TargetCompanyId) => {
    setIsDirty(true);
    setState((prev) => {
      const exists = prev.companies.includes(company);
      const companies = exists
        ? prev.companies.filter((c) => c !== company)
        : [...prev.companies, company];
      return { ...prev, companies };
    });
  };

  const handleSelectTimeline = (timeline: TimelineId) => {
    setIsDirty(true);
    setState((prev) => ({ ...prev, timeline }));
  };

  const handleSelectFormat = (format: PracticeFormatId) => {
    setIsDirty(true);
    setState((prev) => ({ ...prev, format }));
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => prev - 1);
    }
  };

  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-between py-6 px-4 sm:px-8">
        <header className="mx-auto w-full max-w-4xl flex items-center justify-between gap-4 pb-6">
          <Logo variant="full" size="sm" />
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 flex flex-col items-center justify-center py-20">
          <Spin size="lg" />
        </main>
      </div>
    );
  }

  const isSubmitting = completeMutation.isPending;

  const handleFinish = () => {
    completeMutation.mutate(
      {
        data: {
          role: state.role,
          level: state.level,
          companies: state.companies,
          timeline: state.timeline,
          format: state.format,
          isSkipped: false,
        },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: getProfileControllerGetMyProfileQueryKey(),
          });
          void queryClient.invalidateQueries({
            queryKey: getDashboardControllerGetReadinessQueryKey(),
          });
          toast.push({
            status: "success",
            title: t("onboarding.toasts.savedTitle", {
              defaultValue: "Цели сохранены",
            }),
            description: t("onboarding.toasts.savedDesc", {
              defaultValue: "Персональный план подготовки обновлен",
            }),
          });
          if (state.format === "sandbox") {
            router.replace(paths.sandbox);
          } else if (state.format === "peer") {
            router.replace(paths.partners);
          } else {
            router.replace(paths.dashboard);
          }
        },
        onError: () => {
          toast.push({
            status: "error",
            title: t("onboarding.toasts.errorTitle", {
              defaultValue: "Ошибка сохранения",
            }),
            description: t("onboarding.toasts.errorDesc", {
              defaultValue: "Не удалось сохранить цели, попробуйте еще раз",
            }),
          });
        },
      },
    );
  };

  const handleSkip = () => {
    completeMutation.mutate(
      {
        data: {
          isSkipped: true,
          companies: [],
        },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: getProfileControllerGetMyProfileQueryKey(),
          });
          void queryClient.invalidateQueries({
            queryKey: getDashboardControllerGetReadinessQueryKey(),
          });
          router.replace(paths.dashboard);
        },
        onError: () => {
          router.replace(paths.dashboard);
        },
      },
    );
  };

  const progressPercentage = (step / TOTAL_STEPS) * 100;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between py-6 px-4 sm:px-8">
      {/* Top Header */}
      <header className="mx-auto w-full max-w-4xl flex items-center justify-between gap-4 pb-6">
        <Logo variant="full" size="sm" />

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="text-muted-foreground hover:text-foreground"
          >
            {isSubmitting ? <Spin size="sm" className="mr-1.5" /> : null}
            {t("onboarding.skip")}
          </Button>
        </div>
      </header>

      {/* Main Wizard Container */}
      <main className="mx-auto w-full max-w-4xl flex-1 flex flex-col justify-center py-4">
        {/* Step Progress & Counter */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            <span>
              {t("onboarding.stepCounter", {
                current: step,
                total: TOTAL_STEPS,
              })}
            </span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <Progress value={progressPercentage} className="h-1.5" />
        </div>

        {/* Dynamic Step View */}
        <div className="transition-all duration-300">
          {step === 1 && (
            <StepRole
              selectedRole={state.role}
              onSelectRole={handleSelectRole}
            />
          )}

          {step === 2 && (
            <StepTarget
              selectedLevel={state.level}
              onSelectLevel={handleSelectLevel}
              selectedCompanies={state.companies}
              onToggleCompany={handleToggleCompany}
              selectedTimeline={state.timeline}
              onSelectTimeline={handleSelectTimeline}
            />
          )}

          {step === 3 && (
            <StepFormat
              selectedFormat={state.format}
              onSelectFormat={handleSelectFormat}
              role={state.role}
              level={state.level}
              companies={state.companies}
            />
          )}
        </div>
      </main>

      {/* Bottom Actions Bar - Sticky on mobile */}
      <footer className="sticky bottom-0 bg-background/95 backdrop-blur z-20 py-4 mx-auto w-full max-w-4xl border-t border-border/50 flex items-center justify-between gap-4">
        <div>
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleBack}
              disabled={isSubmitting}
              className="gap-2"
            >
              <ArrowLeftIcon className="size-4" />
              <span>{t("onboarding.back")}</span>
            </Button>
          ) : (
            <div className="w-20" />
          )}
        </div>

        <div>
          {step < TOTAL_STEPS ? (
            <Button
              type="button"
              variant="default"
              size="lg"
              onClick={handleNext}
              disabled={isSubmitting}
              className="gap-2 px-6"
            >
              <span>{t("onboarding.next")}</span>
              <ArrowRightIcon className="size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="default"
              size="lg"
              onClick={handleFinish}
              disabled={isSubmitting}
              className="gap-2 px-6 shadow-md"
            >
              {isSubmitting ? (
                <Spin size="sm" className="mr-1" />
              ) : (
                <CheckIcon className="size-4" />
              )}
              <span>{t("onboarding.finish")}</span>
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
