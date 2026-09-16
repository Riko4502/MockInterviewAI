"use client";

import { Button } from "@packages/ui";
import { useRouter } from "next/navigation";

interface InvalidTokenAlertProps {
  title?: string;
  description?: string;
}

export function InvalidTokenAlert({
  title = "Срок действия ссылки истек",
  description = "Запросите сброс пароля повторно.",
}: InvalidTokenAlertProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="w-full rounded-lg border border-destructive/30 bg-destructive/10 p-4">
        <p className="text-sm font-medium text-destructive">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={() => router.push("/forgot-password")}
      >
        Запросить сброс пароля
      </Button>
    </div>
  );
}
