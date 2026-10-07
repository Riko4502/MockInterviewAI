"use client";

import { useEffect, useRef, useState } from "react";
import { formatDuration } from "../../lib/formatters";

export interface SessionCountdownTimerProps {
  seconds: number;
  label: string;
  onExpire?: () => void;
}

export function SessionCountdownTimer({
  seconds,
  label,
  onExpire,
}: SessionCountdownTimerProps) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor(seconds)),
  );
  const expired = useRef(false);

  useEffect(() => {
    const initial = Number.isFinite(seconds)
      ? Math.max(0, Math.floor(seconds))
      : 0;
    setRemaining(initial);
    if (initial === 0) {
      if (!expired.current) {
        expired.current = true;
        onExpire?.();
      }
      return;
    }

    expired.current = false;
    const deadline = Date.now() + initial * 1000;
    const interval = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) {
        window.clearInterval(interval);
        if (!expired.current) {
          expired.current = true;
          onExpire?.();
        }
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [seconds, onExpire]);

  return (
    <p className="text-sm tabular-nums text-muted-foreground" aria-live="off">
      {label}{" "}
      <time dateTime={`PT${remaining}S`}>{formatDuration(remaining)}</time>
    </p>
  );
}
