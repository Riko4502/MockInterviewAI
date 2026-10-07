"use client";

import {
  type LiveMatchToggleDto,
  LiveMatchToggleDtoLevel,
  LiveMatchToggleDtoSpecialization,
} from "@packages/api";
import { Dialog, Label, Select, Switch, Typography } from "@packages/ui";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { validate as isValidUUID } from "uuid";
import { playChimeSound } from "@/features/media-settings";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";
import {
  useLiveMatchMutation,
  useLiveMatchParametersQuery,
  useLiveMatchStateQuery,
} from "../../model/use-dashboard-mutations";

interface LiveMatchControlProps {
  targetSpecialization?: LiveMatchToggleDto["specialization"];
  targetLevel?: LiveMatchToggleDto["level"];
}

export function LiveMatchControl({
  targetSpecialization,
  targetLevel,
}: LiveMatchControlProps) {
  const { t } = useTranslation("dashboard");
  const router = useRouter();
  const id = useId();
  const [selectedSpecialization, setSpecialization] =
    useState(targetSpecialization);
  const [selectedLevel, setLevel] = useState(targetLevel);
  const [matchedSessionId, setMatchedSessionId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const handledSessionIdsRef = useRef(new Set<string>());
  const navigationStartedRef = useRef(false);
  const isMountedRef = useRef(true);
  const { data: state } = useLiveMatchStateQuery();
  const mutation = useLiveMatchMutation();
  const { data: queueParameters } = useLiveMatchParametersQuery();

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  useEffect(() => {
    if (!matchedSessionId || countdown === 0) return;
    const timer = window.setTimeout(() => {
      setCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, matchedSessionId]);

  useEffect(() => {
    if (!matchedSessionId || countdown !== 0 || navigationStartedRef.current) {
      return;
    }
    navigationStartedRef.current = true;
    router.push(`${paths.sandbox}?room=${matchedSessionId}`);
  }, [countdown, matchedSessionId, router]);
  const searching = state?.status === "SEARCHING";
  const matched = state?.status === "MATCHED";
  const specialization =
    (searching || matched ? queueParameters?.specialization : undefined) ??
    selectedSpecialization;
  const level =
    (searching || matched ? queueParameters?.level : undefined) ??
    selectedLevel;
  const locked = searching || matched || mutation.isPending;
  const canToggle =
    Boolean(specialization && level) && !mutation.isPending && !matched;

  function toggle(isSearching: boolean) {
    if (!specialization || !level || !canToggle) return;
    void mutation
      .mutateAsync({ data: { isSearching, specialization, level } })
      .then((response) => {
        if (!isMountedRef.current) return;

        if (response.status === "SEARCHING") {
          // TODO
        }

        if (
          response.status !== "MATCHED" ||
          !response.sessionId ||
          !isValidUUID(response.sessionId) ||
          handledSessionIdsRef.current.has(response.sessionId)
        ) {
          return;
        }

        handledSessionIdsRef.current.add(response.sessionId);
        navigationStartedRef.current = false;
        setCountdown(3);
        setMatchedSessionId(response.sessionId);
        void playChimeSound(80);
      })
      .catch(() => {
        // The mutation state exposes the existing inline error message.
      });
  }

  return (
    <section
      id="live-match"
      aria-labelledby={`${id}-title`}
      className="space-y-4 rounded-xl border border-border bg-muted/30 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={`relative flex size-10 shrink-0 items-center justify-center rounded-full border ${searching ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
          >
            {searching && (
              <span className="absolute inset-0 rounded-full border border-primary motion-safe:animate-ping motion-reduce:hidden" />
            )}
            <span
              className={`size-3 rounded-full ${searching ? "bg-primary motion-safe:animate-pulse" : "bg-current"}`}
            />
          </span>
          <Typography as="h2" variant="large" id={`${id}-title`}>
            {t("liveMatch.title")}
          </Typography>
        </div>
        <Switch
          aria-label={t("liveMatch.switchLabel")}
          aria-describedby={`${id}-status ${id}-description`}
          checked={searching}
          disabled={!canToggle}
          onCheckedChange={(isSearching) => toggle(isSearching)}
          className="motion-reduce:transition-none"
        />
      </div>
      <p id={`${id}-description`} className="text-sm text-muted-foreground">
        {t("liveMatch.description")}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${id}-specialization`}>
            {t("liveMatch.specialization")}
          </Label>
          <Select
            value={specialization ?? ""}
            disabled={locked}
            onValueChange={(value) => {
              const selected = Object.values(
                LiveMatchToggleDtoSpecialization,
              ).find((item) => item === value);
              if (selected) setSpecialization(selected);
            }}
          >
            <Select.Trigger id={`${id}-specialization`} className="w-full">
              <Select.Value placeholder={t("liveMatch.choose")} />
            </Select.Trigger>
            <Select.Content>
              {Object.values(LiveMatchToggleDtoSpecialization).map((value) => (
                <Select.Item key={value} value={value}>
                  {t(`specializations.${value}`)}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-level`}>{t("liveMatch.level")}</Label>
          <Select
            value={level ?? ""}
            disabled={locked}
            onValueChange={(value) => {
              const selected = Object.values(LiveMatchToggleDtoLevel).find(
                (item) => item === value,
              );
              if (selected) setLevel(selected);
            }}
          >
            <Select.Trigger id={`${id}-level`} className="w-full">
              <Select.Value placeholder={t("liveMatch.choose")} />
            </Select.Trigger>
            <Select.Content>
              {Object.values(LiveMatchToggleDtoLevel).map((value) => (
                <Select.Item key={value} value={value}>
                  {t(`levels.${value}`)}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
      </div>
      <output
        id={`${id}-status`}
        aria-live="polite"
        className="block text-sm font-medium"
      >
        {state ? t(`liveMatch.${state.status}`) : t("liveMatch.unknown")}
      </output>
      {!specialization || !level ? (
        <p className="text-sm text-muted-foreground">
          {t("liveMatch.parametersRequired")}
        </p>
      ) : null}
      {mutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t("errors.liveMatch")}
        </p>
      )}
      <Dialog open={matchedSessionId !== null}>
        <Dialog.Content
          showCloseButton={false}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          aria-describedby={`${id}-match-redirect`}
        >
          <Dialog.Header>
            <Dialog.Title>{t("liveMatch.matchFoundTitle")}</Dialog.Title>
            <Dialog.Description id={`${id}-match-redirect`}>
              {t("liveMatch.matchFoundRedirect", { countdown })}
            </Dialog.Description>
          </Dialog.Header>
        </Dialog.Content>
      </Dialog>
    </section>
  );
}
