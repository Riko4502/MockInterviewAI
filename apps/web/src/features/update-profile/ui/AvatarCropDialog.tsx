"use client";

import { Dialog } from "@packages/ui";
import type { RefObject } from "react";
import { CropEditor } from "./CropEditor";

type AvatarCropDialogProps = {
  imageSrc: string | null;
  isSubmitting: boolean;
  errorMessage?: string | null;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  onCloseAutoFocus?: (event: Event) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: (file: File) => void;
};

export function AvatarCropDialog({
  imageSrc,
  isSubmitting,
  errorMessage,
  triggerRef,
  onCloseAutoFocus,
  onOpenChange,
  onConfirm,
}: AvatarCropDialogProps) {
  const handleCloseAutoFocus = (event: Event) => {
    if (onCloseAutoFocus) {
      onCloseAutoFocus(event);
      return;
    }
    if (triggerRef?.current) {
      event.preventDefault();
      triggerRef.current.focus();
    }
  };

  return (
    <Dialog
      open={imageSrc !== null}
      onOpenChange={(open) => {
        if (isSubmitting) {
          return;
        }
        onOpenChange(open);
      }}
    >
      {imageSrc ? (
        <CropEditor
          key={imageSrc}
          imageSrc={imageSrc}
          isSubmitting={isSubmitting}
          errorMessage={errorMessage}
          onCloseAutoFocus={handleCloseAutoFocus}
          onCancel={() => onOpenChange(false)}
          onConfirm={onConfirm}
        />
      ) : null}
    </Dialog>
  );
}
