import { Card } from "@packages/ui";
import { cn } from "@packages/utils";

interface ScoreMetricCardProps {
  value: string;
  label: string;
  valueColor?: string;
}

export function ScoreMetricCard({
  value,
  label,
  valueColor = "text-white",
}: ScoreMetricCardProps) {
  return (
    <Card className="p-3 rounded-xl bg-[#0a0c16] border-white/10 text-center">
      <div className={cn("text-lg sm:text-xl font-bold font-mono", valueColor)}>
        {value}
      </div>
      <div className="text-[11px] text-slate-400 mt-0.5">{label}</div>
    </Card>
  );
}
