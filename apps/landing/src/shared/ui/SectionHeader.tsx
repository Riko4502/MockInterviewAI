import { Badge, Typography } from "@packages/ui";
import { cn } from "@packages/utils";

interface SectionHeaderProps {
  badge: string;
  title: string;
  subtitle: string;
  className?: string;
}

export function SectionHeader({
  badge,
  title,
  subtitle,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn("text-center max-w-3xl mx-auto mb-16 md:mb-24", className)}
    >
      <Badge
        variant="statusInfo"
        className="mb-4 bg-violet-500/10 border-violet-500/30 text-violet-300 font-semibold tracking-wider uppercase shadow-sm shadow-violet-500/20"
      >
        {badge}
      </Badge>
      <Typography.H2 className="border-b-0 pb-0 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-4">
        {title}
      </Typography.H2>
      <Typography.Lead className="text-base sm:text-lg text-slate-300">
        {subtitle}
      </Typography.Lead>
    </div>
  );
}
