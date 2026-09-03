import { Badge } from "@packages/ui";

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
    <div className="mt-3 p-3 rounded-xl bg-violet-950/60 border border-violet-500/40 text-[11px] text-violet-200">
      <div className="flex items-center justify-between font-semibold mb-1">
        <span className="flex items-center gap-1.5 text-violet-300">
          <span>💡</span> {title}
        </span>
        <Badge
          variant="statusInfo"
          className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/30 text-violet-200 font-mono"
        >
          {badgeText}
        </Badge>
      </div>
      <div className="text-slate-300 text-[10.5px]">{hintText}</div>
    </div>
  );
}
