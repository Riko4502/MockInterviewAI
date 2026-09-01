import { cn } from "@packages/utils";

interface StepHeaderProps {
  stepNumber: string;
  tag: string;
  title: string;
  description: string;
  className?: string;
}

export function StepHeader({
  stepNumber,
  tag,
  title,
  description,
  className,
}: StepHeaderProps) {
  return (
    <div className={cn("flex flex-col items-start", className)}>
      <div className="flex items-center gap-3 mb-4">
        <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-violet-600/20 border border-violet-500/40 text-violet-400 font-mono font-bold text-xs">
          {stepNumber}
        </span>
        <span className="text-xs font-mono font-semibold text-violet-400 tracking-wider">
          {tag}
        </span>
      </div>

      <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4">
        {title}
      </h3>
      <p className="text-slate-300 text-base leading-relaxed mb-6">
        {description}
      </p>
    </div>
  );
}
