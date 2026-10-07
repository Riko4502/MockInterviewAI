import { cn } from "@packages/utils";

export interface SkillBadgeProps {
  skill: string;
  className?: string;
}

export function SkillBadge({ skill, className }: SkillBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-muted/70 px-2 py-0.5 font-mono text-xs font-medium text-foreground/80 border border-border/40",
        className,
      )}
    >
      {skill}
    </span>
  );
}
