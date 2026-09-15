import { Typography } from "@packages/ui";
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
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full apple-badge-intelligence backdrop-blur-md mb-5 group transition-transform hover:scale-[1.02]">
        <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 animate-pulse" />
        <span className="text-xs font-semibold text-gradient-intelligence tracking-wider uppercase">
          {badge}
        </span>
      </div>
      <Typography.H2 className="border-b-0 pb-0 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-[-0.03em] text-foreground mb-4">
        <span className="text-gradient-titanium">{title}</span>
      </Typography.H2>
      <Typography.Lead className="text-base sm:text-lg text-muted-foreground font-normal max-w-2xl mx-auto leading-relaxed">
        {subtitle}
      </Typography.Lead>
    </div>
  );
}
