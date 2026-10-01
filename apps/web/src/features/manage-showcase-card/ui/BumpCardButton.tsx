"use client";

import { TrendUpIcon } from "@packages/icons";
import { Button } from "@packages/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { useShowcaseMutations } from "../model/use-showcase-mutations";

export interface BumpCardButtonProps {
  cardId: string;
  bumpedAt?: Date | string;
  className?: string;
  size?: "sm" | "default";
}

const BUMP_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function formatCooldown(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / (1000 * 60)));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}ч ${minutes}м`;
  }
  return `${minutes}м`;
}

export function BumpCardButton({
  cardId,
  bumpedAt,
  className,
  size = "sm",
}: BumpCardButtonProps) {
  const { t } = useTranslation("showcase");
  const { bumpCard, isBumping } = useShowcaseMutations();
  const [timeLeftMs, setTimeLeftMs] = useState<number>(0);

  useEffect(() => {
    if (!bumpedAt) {
      setTimeLeftMs(0);
      return;
    }

    const calculateTimeLeft = () => {
      const lastBumpTime = new Date(bumpedAt).getTime();
      const nextAvailableTime = lastBumpTime + BUMP_COOLDOWN_MS;
      const diff = nextAvailableTime - Date.now();
      setTimeLeftMs(Math.max(0, diff));
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 10000);

    return () => clearInterval(timer);
  }, [bumpedAt]);

  const isCooldownActive = timeLeftMs > 0;

  const handleBump = async () => {
    if (isCooldownActive || isBumping) return;
    await bumpCard(cardId);
  };

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleBump}
      disabled={isCooldownActive || isBumping}
      className={className}
      title={
        isCooldownActive
          ? t("card.bumpCooldown", {
              time: formatCooldown(timeLeftMs),
            })
          : t("card.bump")
      }
    >
      <TrendUpIcon className="size-3.5 shrink-0 text-primary" />
      <span>
        {isCooldownActive
          ? t("card.bumpCooldown", {
              time: formatCooldown(timeLeftMs),
            })
          : t("card.bump")}
      </span>
    </Button>
  );
}
