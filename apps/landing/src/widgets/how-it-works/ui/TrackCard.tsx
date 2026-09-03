import { Badge, Card } from "@packages/ui";
import { cn } from "@packages/utils";

interface TrackCardProps {
  title: string;
  description: string;
  duration: string;
  statusText: string;
  selected?: boolean;
}

export function TrackCard({
  title,
  description,
  duration,
  statusText,
  selected = false,
}: TrackCardProps) {
  return (
    <Card
      className={cn(
        "p-4 rounded-xl flex flex-col justify-between transition-all cursor-pointer",
        selected
          ? "bg-violet-950/40 border-2 border-violet-500 shadow-lg shadow-violet-950/50"
          : "bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]",
      )}
    >
      <Card.Header className="p-0 space-y-1">
        <Card.Title className="text-sm font-bold text-white">
          {title}
        </Card.Title>
        <Card.Description
          className={cn(
            "text-xs",
            selected ? "text-slate-300" : "text-slate-400",
          )}
        >
          {description}
        </Card.Description>
      </Card.Header>
      <Card.Footer
        className={cn(
          "p-0 mt-3 flex items-center justify-between text-[11px] font-mono",
          selected ? "text-violet-300" : "text-slate-400",
        )}
      >
        <span>{duration}</span>
        {selected ? (
          <Badge
            variant="statusSuccess"
            className="text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/20 text-[10px]"
          >
            {statusText}
          </Badge>
        ) : (
          <span className="text-slate-300">{statusText}</span>
        )}
      </Card.Footer>
    </Card>
  );
}
