import { WandIcon } from "@packages/icons";
import { Badge, Card } from "@packages/ui";

interface AiHintBannerProps {
  title: string;
  badgeText: string;
  hintText: string;
}

export function AiHintBanner({
  title,
  badgeText,
  hintText,
}: AiHintBannerProps) {
  return (
    <Card className="mt-3.5 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-violet-500/10 border border-purple-500/25 dark:border-purple-500/35 backdrop-blur-xl shadow-none ring-0">
      <div className="flex items-center justify-between font-semibold mb-1.5 gap-2">
        <span className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-purple-700 dark:text-purple-300 font-bold min-w-0">
          <span className="w-5 h-5 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
            <WandIcon className="w-3 h-3" />
          </span>
          <span className="truncate">{title}</span>
        </span>
        <Badge
          variant="statusInfo"
          className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-700 dark:text-purple-300 font-mono font-semibold whitespace-nowrap shrink-0"
        >
          {badgeText}
        </Badge>
      </div>
      <div className="text-muted-foreground text-[11px] sm:text-xs leading-relaxed pl-6 sm:pl-7">
        {hintText}
      </div>
    </Card>
  );
}
