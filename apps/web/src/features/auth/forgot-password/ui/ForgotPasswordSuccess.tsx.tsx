"use client";

import { Button } from "@packages/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

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
        Проверьте вашу почту! Мы отправили инструкции по восстановлению пароля
        на адрес <span className="font-medium">{email}</span>.
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
          ? "Отправка..."
          : secondsLeft > 0
            ? `Отправить повторно (${secondsLeft}с)`
            : "Отправить повторно"}
      </Button>

      <Link
        href="/login"
        className="text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        Вернуться ко входу
      </Link>
    </div>
  );
}
