"use client";

import {
  CheckIcon,
  CodeIcon,
  DotIcon,
  GoIcon,
  HubConnectionIcon,
  ReactIcon,
  ZapIcon,
} from "@packages/icons";
import {
  Badge,
  Button,
  Card,
  Carousel,
  type CarouselApi,
  Tabs,
} from "@packages/ui";
import { cn } from "@packages/utils";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  GRADE_DEFINITIONS,
  type GradeId,
  TRACK_DEFINITIONS,
} from "../constants";
import { StepHeader } from "./StepHeader";
import { TrackCard } from "./TrackCard";

export function StepTrackSelect() {
  const { t } = useTranslation("landing");
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(0);
  const [selectedGrade, setSelectedGrade] = useState<GradeId>("senior");
  const [isGenerated, setIsGenerated] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();

  const generateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeTrack =
    TRACK_DEFINITIONS[selectedTrackIndex] ?? TRACK_DEFINITIONS[0];

  const TRACK_ICONS = [
    <ReactIcon key="fe" className="w-4 h-4 text-sky-500" />,
    <GoIcon key="be" className="w-4 h-4 text-cyan-500" />,
    <HubConnectionIcon key="sd" className="w-4 h-4 text-amber-500" />,
    <ZapIcon key="algo" className="w-4 h-4 text-emerald-500" />,
  ];

  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => {
      setSelectedTrackIndex(carouselApi.selectedScrollSnap());
    };
    carouselApi.on("select", onSelect);
    return () => {
      carouselApi.off("select", onSelect);
    };
  }, [carouselApi]);

  const handleSelectTrack = (idx: number) => {
    setSelectedTrackIndex(idx);
    carouselApi?.scrollTo(idx);
  };

  const handleGenerate = () => {
    setIsGenerated(true);
    if (generateTimerRef.current) {
      clearTimeout(generateTimerRef.current);
    }

    generateTimerRef.current = setTimeout(() => {
      setIsGenerated(false);
    }, 3000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
      {/* Left Column: Context & Interactive Quick Filters */}
      <div className="lg:col-span-5 flex flex-col items-start">
        <StepHeader
          stepNumber="01"
          tag={t("howItWorks.step1Tag")}
          title={t("howItWorks.step1Title")}
          description={t("howItWorks.step1Desc")}
        />

        {/* Clickable Topic Pills without badge dots */}
        <div className="flex flex-wrap gap-2 text-xs font-medium w-full mt-2">
          {TRACK_DEFINITIONS.map((track, idx) => {
            const isSelected = selectedTrackIndex === idx;
            return (
              <button
                type="button"
                key={track.id}
                onClick={() => handleSelectTrack(idx)}
                aria-pressed={isSelected}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl border text-xs transition-colors duration-200 cursor-pointer select-none",
                  isSelected
                    ? "bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30 font-semibold"
                    : "bg-black/[0.03] dark:bg-white/[0.04] border-black/[0.06] dark:border-white/[0.08] text-muted-foreground hover:text-foreground hover:border-purple-500/40 hover:bg-purple-500/5 font-medium",
                )}
              >
                <span>{t(track.titleKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Apple Studio Track Selector Card */}
      <div className="lg:col-span-7">
        <Card className="apple-glass rounded-[28px] p-5 sm:p-7 border border-black/[0.08] dark:border-white/[0.08] shadow-2xl relative overflow-hidden backdrop-blur-2xl ring-0">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-56 h-56 bg-purple-600/10 dark:bg-purple-600/15 blur-3xl pointer-events-none rounded-full" />

          {/* Header & Seniority Segmented Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-black/[0.06] dark:border-white/[0.08] gap-3 relative z-10">
            <div className="flex items-center gap-2">
              <DotIcon className="w-4 h-4 text-purple-500 animate-pulse" />
              <span className="text-sm font-bold text-foreground">
                {t("howItWorks.step1SelectTitle")}
              </span>
            </div>

            {/* Apple Segmented Grade Tabs */}
            <Tabs
              value={selectedGrade}
              onValueChange={(val) => setSelectedGrade(val as GradeId)}
            >
              <Tabs.List className="bg-black/[0.04] dark:bg-white/[0.06] p-1 rounded-xl border border-black/[0.06] dark:border-white/[0.08]">
                {GRADE_DEFINITIONS.map(({ id, level }) => (
                  <Tabs.Trigger
                    key={id}
                    value={id}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-lg transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold"
                  >
                    {level}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </Tabs>
          </div>

          {/* Track Carousel with Controls */}
          <Carousel
            setApi={setCarouselApi}
            opts={{
              align: "start",
              loop: true,
            }}
            className="w-full relative z-10"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] font-mono text-muted-foreground">
                {selectedTrackIndex + 1} / {TRACK_DEFINITIONS.length}
              </span>
              <div className="flex items-center gap-1.5">
                <Carousel.Previous className="static translate-y-0 size-7 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] border-black/[0.06] dark:border-white/[0.08] hover:bg-purple-500/10 hover:text-purple-600 text-foreground" />
                <Carousel.Next className="static translate-y-0 size-7 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] border-black/[0.06] dark:border-white/[0.08] hover:bg-purple-500/10 hover:text-purple-600 text-foreground" />
              </div>
            </div>

            <Carousel.Content className="-ml-3">
              {TRACK_DEFINITIONS.map((track, idx) => {
                const isSelected = selectedTrackIndex === idx;
                return (
                  <Carousel.Item
                    key={track.id}
                    className="pl-3 basis-full sm:basis-1/2"
                  >
                    <TrackCard
                      title={t(track.titleKey)}
                      description={t(track.descriptionKey)}
                      duration={track.duration}
                      icon={TRACK_ICONS[idx]}
                      statusText={
                        selectedTrackIndex === idx
                          ? t("howItWorks.track1Status")
                          : t("howItWorks.selectAction")
                      }
                      selected={selectedTrackIndex === idx}
                      aria-pressed={isSelected}
                      onClick={() => handleSelectTrack(idx)}
                    />
                  </Carousel.Item>
                );
              })}
            </Carousel.Content>
          </Carousel>

          {/* Dynamic Live Blueprint Preview Drawer */}
          <Card className="mt-4 p-4 rounded-2xl bg-black/[0.03] dark:bg-[#07070c]/90 border border-purple-500/20 dark:border-purple-500/30 relative z-10 backdrop-blur-xl shadow-none ring-0 min-h-[160px] flex flex-col justify-between gap-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-purple-600 dark:text-purple-400 font-bold">
                    {t("howItWorks.blueprintTitle")}
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="font-semibold text-foreground truncate">
                    {t(activeTrack.titleKey)} (
                    {
                      GRADE_DEFINITIONS.find((g) => g.id === selectedGrade)
                        ?.level
                    }
                    )
                  </span>
                </div>
                <Badge
                  variant="statusInfo"
                  className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/25 shrink-0"
                >
                  {t(
                    GRADE_DEFINITIONS.find((g) => g.id === selectedGrade)
                      ?.labelKey ?? "howItWorks.gradeSenior",
                  )}
                </Badge>
              </div>

              {/* Generated Challenge Task Preview */}
              <Card className="px-3.5 py-2.5 rounded-xl bg-background/80 dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06] flex flex-row items-center gap-2.5 shadow-none ring-0 min-h-[46px]">
                <CodeIcon className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <div className="text-xs leading-relaxed line-clamp-2 flex-1 min-w-0">
                  <span className="font-semibold text-foreground mr-1.5">
                    {t("howItWorks.blueprintTaskLabel")}
                  </span>
                  <span className="text-muted-foreground">
                    {t(activeTrack.tasksByGrade[selectedGrade])}
                  </span>
                </div>
              </Card>
            </div>

            {/* Focus Tags & Action Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs">
              <div className="flex flex-wrap gap-1.5 items-center min-w-0 flex-1">
                <span className="text-[11px] text-muted-foreground mr-1 shrink-0">
                  {t("howItWorks.blueprintFocusLabel")}
                </span>
                {activeTrack.focusTags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-md bg-black/[0.04] dark:bg-white/[0.06] text-[10px] font-mono text-muted-foreground border border-black/[0.04] dark:border-white/[0.06] shrink-0"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <Button
                type="button"
                size="xs"
                variant={isGenerated ? "success" : "default"}
                onClick={handleGenerate}
                className={cn(
                  "font-semibold text-xs px-3.5 py-1.5 rounded-xl shrink-0 transition-all shadow-md active:scale-95",
                  isGenerated
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/25",
                )}
              >
                {isGenerated ? (
                  <span className="flex items-center gap-1.5">
                    <CheckIcon className="w-3.5 h-3.5" />
                    {t("howItWorks.blueprintReady")}
                  </span>
                ) : (
                  <span>{t("howItWorks.blueprintGenerateBtn")}</span>
                )}
              </Button>
            </div>
          </Card>
        </Card>
      </div>
    </div>
  );
}
