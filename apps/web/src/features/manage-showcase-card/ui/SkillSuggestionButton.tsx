import { PlusIcon } from "@packages/icons";

export interface SkillSuggestionButtonProps {
  skill: string;
  onSelect: (skill: string) => void;
}

export function SkillSuggestionButton({
  skill,
  onSelect,
}: SkillSuggestionButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(skill)}
      className="inline-flex items-center gap-1 rounded-md bg-muted/60 hover:bg-muted px-2 py-0.5 text-xs text-foreground/80 hover:text-foreground border border-border/40 transition-colors cursor-pointer"
    >
      <PlusIcon className="size-2.5" />
      <span>{skill}</span>
    </button>
  );
}
