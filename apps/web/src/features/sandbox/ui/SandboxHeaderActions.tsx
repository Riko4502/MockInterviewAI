"use client";

import type { LanguageId, Theme } from "@packages/editor";
import {
  CameraIcon,
  MoonIcon,
  PlayIcon,
  SlidersIcon,
  SunIcon,
  UndoIcon,
} from "@packages/icons";
import { Button, Select, useTheme } from "@packages/ui";
import { useTranslation } from "react-i18next";
import { usePreferences } from "@/entities/user";
import "@/shared/lib/i18n";
import { useSandboxMedia } from "../model/SandboxMediaContext";
import { useSandboxStore } from "../model/useSandboxStore";

const LANGUAGES: { id: LanguageId; label: string }[] = [
  { id: "typescript", label: "TypeScript" },
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python" },
  { id: "go", label: "Go" },
  { id: "cpp", label: "C++" },
  { id: "java", label: "Java" },
];

interface SandboxHeaderActionsProps {
  onLanguageChange?: (lang: LanguageId) => void;
  onResetCode?: () => void;
  onRunCode?: () => void;
}

export function SandboxHeaderActions({
  onLanguageChange,
  onResetCode,
  onRunCode,
}: SandboxHeaderActionsProps) {
  const { t } = useTranslation("interview");
  const { isCallConnected: isInCall, setIsSettingsOpen } = useSandboxMedia();
  const isRunning = useSandboxStore((s) => s.isRunning);
  const language = useSandboxStore((s) => s.language);
  const setLanguage = useSandboxStore((s) => s.setLanguage);
  const theme = useSandboxStore((s) => s.theme);
  const toggleTheme = useSandboxStore((s) => s.toggleTheme);
  const resetCode = useSandboxStore((s) => s.resetCode);
  const isVideoOpen = useSandboxStore((s) => s.isVideoOpen);
  const toggleVideoOpen = useSandboxStore((s) => s.toggleVideoOpen);
  const { setTheme: setAppTheme } = useTheme();
  const { changeTheme } = usePreferences();

  const handleSelectLanguage = (val: string) => {
    const nextLang = val as LanguageId;
    if (onLanguageChange) {
      onLanguageChange(nextLang);
    } else {
      setLanguage(nextLang);
    }
  };

  const handleReset = () => {
    if (onResetCode) {
      onResetCode();
    } else {
      resetCode();
    }
  };

  const handleToggleTheme = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    toggleTheme();
    setAppTheme?.(nextTheme);
    changeTheme(nextTheme);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Кнопка открытия/закрытия видеовиджета */}
      <Button
        variant={isVideoOpen ? "primary" : "outline"}
        size="sm"
        onClick={toggleVideoOpen}
        className={`h-9 gap-1.5 px-3 text-xs transition-colors shadow-2xs ${
          isVideoOpen
            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
            : isInCall
              ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10"
              : ""
        }`}
        title={t("sandbox.header.videoPanelTooltip")}
      >
        <CameraIcon className="size-4" />
        <span>
          {isInCall
            ? t("sandbox.header.inCall")
            : t("sandbox.header.videoCall")}
        </span>
        {isInCall && (
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
        )}
      </Button>

      {/* Выбор языка */}
      <Select value={language} onValueChange={handleSelectLanguage}>
        <Select.Trigger className="h-9 w-32">
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          {LANGUAGES.map((lang) => (
            <Select.Item key={lang.id} value={lang.id}>
              {lang.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>

      {/* Переключатель темы редактора */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleToggleTheme}
        className="size-9"
        title={t("sandbox.header.themeTooltip", { theme })}
        aria-label={t("sandbox.header.themeTooltip", { theme })}
      >
        {theme === "dark" ? (
          <SunIcon className="size-4" />
        ) : (
          <MoonIcon className="size-4" />
        )}
      </Button>

      {/* Настройки звука, речи и устройств */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsSettingsOpen(true)}
        className="size-9 text-muted-foreground hover:text-foreground cursor-pointer"
        title={t("sandbox.videoWidget.controls.settingsTooltip")}
        aria-label={t("sandbox.videoWidget.controls.settingsTooltip")}
      >
        <SlidersIcon className="size-4" />
      </Button>

      {/* Сброс кода */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleReset}
        className="h-9 gap-1.5 px-2.5 text-xs text-muted-foreground"
        title={t("sandbox.header.resetCodeTooltip")}
      >
        <UndoIcon className="size-3.5" />
        {t("sandbox.header.resetCode")}
      </Button>

      {/* Запуск кода */}
      <Button
        variant="primary"
        size="sm"
        disabled={isRunning || !onRunCode}
        onClick={onRunCode}
        className={`h-9 gap-1.5 px-4 text-xs shadow-xs ${
          isRunning || !onRunCode
            ? "bg-emerald-600/50 text-white/70 cursor-not-allowed"
            : "bg-emerald-600 hover:bg-emerald-700 text-white"
        }`}
        title={t("sandbox.header.runCodeTooltip")}
      >
        {isRunning ? (
          <div
            data-testid="run-code-spinner"
            className="size-3.5 animate-spin rounded-full border-2 border-white/60 border-t-transparent"
          />
        ) : (
          <PlayIcon className="size-3.5 fill-current" />
        )}
        {isRunning ? t("sandbox.console.running") : t("sandbox.header.runCode")}
      </Button>
    </div>
  );
}
