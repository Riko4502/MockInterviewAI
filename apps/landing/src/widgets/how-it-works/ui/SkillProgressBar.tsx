interface SkillProgressBarProps {
  label: string;
  scoreText: string;
  percentage: number;
}

export function SkillProgressBar({
  label,
  scoreText,
  percentage,
}: SkillProgressBarProps) {
  return (
    <div>
      <div className="flex justify-between text-xs font-semibold mb-1.5">
        <span className="text-slate-200">{label}</span>
        <span className="text-violet-400 font-mono">{scoreText}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 shadow-sm"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
