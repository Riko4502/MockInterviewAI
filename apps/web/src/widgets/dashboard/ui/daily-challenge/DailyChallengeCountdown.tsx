"use client";

import { useEffect, useRef, useState } from "react";
import { formatDuration } from "../../lib/formatters";

export interface DailyChallengeCountdownProps {
  seconds: number;
  label: string;
  onExpire: () => void;
}

export function DailyChallengeCountdown({
  seconds,
  label,
  onExpire,
}: DailyChallengeCountdownProps) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor(seconds)),
  );
  const expired = useRef(false);

  useEffect(() => {
    const initial = Math.max(0, Math.floor(seconds));
    setRemaining(initial);
    if (initial === 0) {
      if (!expired.current) {
        expired.current = true;
        onExpire();
      }
      return;
    }

    expired.current = false;
    // Отсчитываем полученную с сервера длительность от момента получения, а не от местной полуночи.
    const deadline = Date.now() + initial * 1000;
    const interval = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) {
        window.clearInterval(interval);
        if (!expired.current) {
          expired.current = true;
          onExpire();
        }
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [seconds, onExpire]);

  return (
    <p className="text-sm text-muted-foreground tabular-nums">
      {label}{" "}
      <time dateTime={`PT${remaining}S`}>{formatDuration(remaining)}</time>
    </p>
  );
}
