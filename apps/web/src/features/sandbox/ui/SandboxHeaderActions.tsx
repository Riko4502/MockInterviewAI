import type { LanguageId } from "@packages/editor";
import { CameraIcon, PlayIcon, SettingsIcon, UndoIcon } from "@packages/icons";
import { Button, Select } from "@packages/ui";
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
}

export function SandboxHeaderActions({
  onLanguageChange,
  onResetCode,
}: SandboxHeaderActionsProps) {
  const { isCallConnected: isInCall } = useSandboxMedia();
  const language = useSandboxStore((s) => s.language);
  const setLanguage = useSandboxStore((s) => s.setLanguage);
  const theme = useSandboxStore((s) => s.theme);
  const toggleTheme = useSandboxStore((s) => s.toggleTheme);
  const resetCode = useSandboxStore((s) => s.resetCode);
  const isVideoOpen = useSandboxStore((s) => s.isVideoOpen);
  const toggleVideoOpen = useSandboxStore((s) => s.toggleVideoOpen);

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
        title="Панель видеозвонка"
      >
        <CameraIcon className="size-4" />
        <span>{isInCall ? "В звонке" : "Видеозвонок"}</span>
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
        onClick={toggleTheme}
        className="size-9"
        title={`Текущая тема редактора: ${theme}. Нажмите для переключения`}
      >
        <SettingsIcon className="size-4" />
      </Button>

      {/* Сброс кода */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleReset}
        className="h-9 gap-1.5 px-2.5 text-xs text-muted-foreground"
        title="Сбросить код к начальному шаблону"
      >
        <UndoIcon className="size-3.5" />
        Сброс
      </Button>

      {/* Запуск кода (временно отключено) */}
      <Button
        variant="primary"
        size="sm"
        disabled={true}
        className="h-9 gap-1.5 bg-emerald-600/50 px-4 text-xs text-white/70 cursor-not-allowed shadow-xs"
        title="Запуск кода временно недоступен"
      >
        <PlayIcon className="size-3.5 fill-current" />
        Run Code
      </Button>
    </div>
  );
}
