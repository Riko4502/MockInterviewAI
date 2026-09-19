"use client";

import { Spin } from "@packages/ui";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";

export interface SandboxRoomLoadingProps {
  message?: string;
}

export function SandboxRoomLoading({ message }: SandboxRoomLoadingProps) {
  const { t } = useTranslation("interview");

  return (
    <div
      className="flex items-center justify-center min-h-[400px] w-full"
      data-testid="sandbox-loading"
    >
      <Spin size="lg" tip={message ?? t("sandbox.connecting")} />
    </div>
  );
}
