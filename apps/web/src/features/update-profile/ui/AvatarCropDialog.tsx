"use client";

import { Dialog } from "@packages/ui";
import { CropEditor } from "./CropEditor";

type AvatarCropDialogProps = {
  imageSrc: string | null;
  isSubmitting: boolean;
  errorMessage?: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (file: File) => void;
};

export function AvatarCropDialog({
  imageSrc,
  isSubmitting,
  errorMessage,
  onOpenChange,
  onConfirm,
}: AvatarCropDialogProps) {
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
          onCancel={() => onOpenChange(false)}
          onConfirm={onConfirm}
        />
      ) : null}
    </Dialog>
  );
}
