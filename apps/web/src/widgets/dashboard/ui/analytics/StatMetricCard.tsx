import { Card, Typography } from "@packages/ui";
import type { ReactNode } from "react";

export function StatMetricCard({
  label,
  value,
  children,
}: {
  label: string;
  value: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card className="min-h-40 min-w-0 gap-3">
      <Typography as="h3" variant="muted">
        {label}
      </Typography>
      <div className="text-3xl font-semibold tabular-nums">{value}</div>
      <div className="text-sm text-muted-foreground">{children}</div>
    </Card>
  );
}
