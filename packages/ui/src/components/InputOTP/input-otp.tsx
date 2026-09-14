"use client";

import { cn } from "@packages/utils";
import { OTPInput, OTPInputContext } from "input-otp";
import { useContext } from "react";
import { INPUT_OTP_STYLES } from "./constants";
import type {
  InputOTPGroupProps,
  InputOTPProps,
  InputOTPSeparatorProps,
  InputOTPSlotProps,
} from "./types";

/**
 * Корневой компонент для ввода одноразовых паролей (OTP / PIN-код).
 *
 * Составной API: `InputOTP` (корень) + `InputOTP.Group` + `InputOTP.Slot` + `InputOTP.Separator`.
 * Построен на базе библиотеки `input-otp` с полной поддержкой вставки (paste), мобильной автоподстановки и доступности.
 */
function InputOTPRoot({
  className,
  containerClassName,
  ...props
}: InputOTPProps) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(INPUT_OTP_STYLES.container, containerClassName)}
      className={cn(INPUT_OTP_STYLES.root, className)}
      {...props}
    />
  );
}

function InputOTPGroup({ className, ...props }: InputOTPGroupProps) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn(INPUT_OTP_STYLES.group, className)}
      {...props}
    />
  );
}

function InputOTPSlot({
  index,
  className,
  children,
  ...props
}: InputOTPSlotProps) {
  const inputOTPContext = useContext(OTPInputContext);
  const slot = inputOTPContext.slots[index];

  if (!slot) {
    return null;
  }

  const { char, hasFakeCaret, isActive } = slot;

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(INPUT_OTP_STYLES.slot, className)}
      {...props}
    >
      {children ?? char}
      {hasFakeCaret && (
        <div className={INPUT_OTP_STYLES.caret}>
          <div className={INPUT_OTP_STYLES.caretLine} />
        </div>
      )}
    </div>
  );
}

function InputOTPSeparator({
  className,
  children,
  ...props
}: InputOTPSeparatorProps) {
  return (
    <div
      data-slot="input-otp-separator"
      aria-hidden="true"
      className={cn(INPUT_OTP_STYLES.separator, className)}
      {...props}
    >
      {children ?? <span>&ndash;</span>}
    </div>
  );
}

export const InputOTP = Object.assign(InputOTPRoot, {
  Group: InputOTPGroup,
  Slot: InputOTPSlot,
  Separator: InputOTPSeparator,
});
