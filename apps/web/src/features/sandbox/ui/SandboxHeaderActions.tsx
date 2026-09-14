"use client";

import type { LanguageId, Theme } from "@packages/editor";
import { CameraIcon, PlayIcon, SettingsIcon, UndoIcon } from "@packages/icons";
import { Button, Select } from "@packages/ui";

const LANGUAGES: { id: LanguageId; label: string }[] = [
  { id: "typescript", label: "TypeScript" },
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python" },
  { id: "go", label: "Go" },
  { id: "cpp", label: "C++" },
  { id: "java", label: "Java" },
];

interface SandboxHeaderActionsProps {
  language: LanguageId;
  onLanguageChange: (lang: LanguageId) => void;
  theme: Theme;
  onThemeToggle: () => void;
  onResetCode: () => void;
  onRunCode: () => void;
  isRunning: boolean;
  isVideoOpen: boolean;
  onToggleVideo: () => void;
  isInCall: boolean;
}

export function SandboxHeaderActions({
  language,
  onLanguageChange,
  theme,
  onThemeToggle,
  onResetCode,
  onRunCode,
  isRunning,
  isVideoOpen,
  onToggleVideo,
  isInCall,
}: SandboxHeaderActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Кнопка открытия/закрытия видеовиджета */}
      <Button
        variant={isVideoOpen ? "primary" : "outline"}
        size="sm"
        onClick={onToggleVideo}
        className={`h-9 gap-1.5 px-3 text-xs transition-colors shadow-2xs ${
          isVideoOpen
            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
            : isInCall
              ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10"
              : ""
        }`}
        title="Панель видеозвонка"
      >
        <CameraIcon className="size-4" />
        <span>{isInCall ? "В звонке" : "Видеозвонок"}</span>
        {isInCall && (
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
        )}
      </Button>

      {/* Выбор языка */}
      <Select
        value={language}
        onValueChange={(val) => onLanguageChange(val as LanguageId)}
      >
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
        onClick={onThemeToggle}
        className="size-9"
        title={`Текущая тема редактора: ${theme}. Нажмите для переключения`}
      >
        <SettingsIcon className="size-4" />
      </Button>

      {/* Сброс кода */}
      <Button
        variant="outline"
        size="sm"
        onClick={onResetCode}
        className="h-9 gap-1.5 px-2.5 text-xs text-muted-foreground"
        title="Сбросить код к начальному шаблону"
      >
        <UndoIcon className="size-3.5" />
        Сброс
      </Button>

      {/* Запуск кода */}
      <Button
        variant="primary"
        size="sm"
        onClick={onRunCode}
        disabled={isRunning}
        className="h-9 gap-1.5 bg-emerald-600 px-4 text-xs text-white hover:bg-emerald-700 shadow-xs"
        title="Запустить решение на тест-кейсах (Ctrl+Enter)"
      >
        <PlayIcon className="size-3.5 fill-current" />
        {isRunning ? "Запуск..." : "Run Code"}
      </Button>
    </div>
  );
}
