"use client";

import { Alert, Button } from "@packages/ui";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";

export interface SandboxRoomErrorProps {
  errorMessage: string | null;
  onCreateNewSession: () => void;
}

export function SandboxRoomError({
  errorMessage,
  onCreateNewSession,
}: SandboxRoomErrorProps) {
  const { t } = useTranslation("interview");

  return (
    <div
      className="flex items-center justify-center min-h-[400px] w-full p-6"
      data-testid="sandbox-error"
    >
      <div className="max-w-md w-full space-y-4">
        <Alert variant="destructive">
          <Alert.Title>{t("sandbox.errorTitle")}</Alert.Title>
          <Alert.Description>{errorMessage}</Alert.Description>
        </Alert>
        <div className="flex justify-center">
          <Button variant="default" onClick={onCreateNewSession}>
            {t("sandbox.createNew")}
          </Button>
        </div>
      </div>
    </div>
  );
}
