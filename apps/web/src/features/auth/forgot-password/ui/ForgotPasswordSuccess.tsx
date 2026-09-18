"use client";

import { Button } from "@packages/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { paths } from "@/shared/config";

const RESEND_TIMEOUT_SECONDS = 60;

interface ForgotPasswordSuccessProps {
  email: string;
  isResending: boolean;
  onResend: () => void;
}

export function ForgotPasswordSuccess({
  email,
  isResending,
  onResend,
}: ForgotPasswordSuccessProps) {
  const { t } = useTranslation("auth");
  const [secondsLeft, setSecondsLeft] = useState(RESEND_TIMEOUT_SECONDS);

  useEffect(() => {
    if (secondsLeft === 0) return;

    const timerId = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timerId);
  }, [secondsLeft]);

  const handleResend = () => {
    onResend();
    setSecondsLeft(RESEND_TIMEOUT_SECONDS);
  };

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-sm text-foreground">
        {t("forgotPassword.success.message", { email })}
      </p>

      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={secondsLeft > 0 || isResending}
        onClick={handleResend}
        className="w-full"
      >
        {isResending
          ? t("forgotPassword.success.resending")
          : secondsLeft > 0
            ? t("forgotPassword.success.resendWithTimer", {
                seconds: secondsLeft,
              })
            : t("forgotPassword.success.resend")}
      </Button>

      <Link
        href={paths.login}
        className="text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        {t("forgotPassword.backToLogin")}
      </Link>
    </div>
  );
}
