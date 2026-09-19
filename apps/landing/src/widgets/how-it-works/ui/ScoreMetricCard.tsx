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
  valueColor = "text-foreground",
}: ScoreMetricCardProps) {
  return (
    <Card className="p-3 rounded-xl bg-accent/40 dark:bg-[#0a0c16] border-border dark:border-white/10 text-center shadow-none">
      <div className={cn("text-lg sm:text-xl font-bold font-mono", valueColor)}>
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
    </Card>
  );
}
