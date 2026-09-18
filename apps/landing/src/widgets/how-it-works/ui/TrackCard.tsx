import { ArrowRightIcon, CheckIcon } from "@packages/icons";
import { cn } from "@packages/utils";
import type { ReactNode } from "react";

interface TrackCardProps {
  title: string;
  description: string;
  duration: string;
  statusText: string;
  icon?: ReactNode;
  selected?: boolean;
  "aria-pressed"?: boolean;
  onClick?: () => void;
}

export function TrackCard({
  title,
  description,
  duration,
  statusText,
  icon,
  selected = false,
  "aria-pressed": ariaPressed,
  onClick,
}: TrackCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ariaPressed ?? selected}
      className={cn(
        "w-full p-4 rounded-2xl flex flex-col justify-between transition-colors duration-200 text-left cursor-pointer group select-none relative overflow-hidden backdrop-blur-xl shadow-none min-h-[138px] border outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
        selected
          ? "bg-violet-500/10 dark:bg-violet-950/40 border-violet-500 ring-1 ring-violet-500/50 shadow-md shadow-violet-500/10 dark:shadow-violet-950/40"
          : "bg-black/[0.02] dark:bg-white/[0.03] border-black/[0.06] dark:border-white/[0.08] hover:border-violet-500/40 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
      )}
    >
      <div className="p-0 space-y-1.5 min-w-0 w-full">
        <div className="flex items-center gap-2">
          {icon && (
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <span className="text-sm font-bold text-foreground truncate block">
            {title}
          </span>
        </div>
        <p
          className={cn(
            "text-xs leading-relaxed line-clamp-2 font-normal min-h-[34px] flex items-center",
            selected ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {description}
        </p>
      </div>

      <div className="w-full mt-3.5 pt-3 px-0 pb-0 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between text-[11px] font-mono h-[34px]">
        <span className="text-muted-foreground flex items-center gap-1 font-medium">
          {duration}
        </span>
        {selected ? (
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 h-[22px]">
            <CheckIcon className="w-3.5 h-3.5 text-current" />
            <span>{statusText}</span>
          </span>
        ) : (
          <span className="text-muted-foreground group-hover:text-foreground transition-colors h-[22px] flex items-center gap-1 font-medium">
            <span>{statusText}</span>
            <ArrowRightIcon className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
          </span>
        )}
      </div>
    </button>
  );
}
