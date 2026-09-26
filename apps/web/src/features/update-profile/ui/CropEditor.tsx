"use client";

import { Button, Dialog, Input, Spin } from "@packages/ui";
import { type ChangeEvent, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { useTranslation } from "react-i18next";
import { getCroppedImageFile } from "../lib/get-cropped-image";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

type CropEditorProps = {
  imageSrc: string;
  isSubmitting: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

export function CropEditor({
  imageSrc,
  isSubmitting,
  errorMessage,
  onCancel,
  onConfirm,
}: CropEditorProps) {
  const { t } = useTranslation("common");
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [cropError, setCropError] = useState(false);

  const busy = isSubmitting || isCropping;

  const handleConfirm = async () => {
    if (!croppedAreaPixels || busy) {
      return;
    }

    setCropError(false);
    setIsCropping(true);

    try {
      const file = await getCroppedImageFile(imageSrc, croppedAreaPixels);
      onConfirm(file);
    } catch {
      setCropError(true);
    } finally {
      setIsCropping(false);
    }
  };

  return (
    <Dialog.Content
      className="sm:max-w-md"
      showCloseButton={!busy}
      onEscapeKeyDown={(event) => {
        if (busy) {
          event.preventDefault();
        }
      }}
      onInteractOutside={(event) => {
        if (busy) {
          event.preventDefault();
        }
      }}
    >
      <Dialog.Header>
        <Dialog.Title>{t("profile.cropTitle")}</Dialog.Title>
        <Dialog.Description>{t("profile.cropDescription")}</Dialog.Description>
      </Dialog.Header>

      <div className="relative h-72 overflow-hidden rounded-lg bg-muted">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          objectFit="contain"
          showGrid={false}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_area, pixels) => {
            setCroppedAreaPixels(pixels);
          }}
        />
      </div>

      <label className="flex flex-col gap-2" htmlFor="avatar-zoom">
        <span className="text-sm font-medium">{t("profile.zoom")}</span>
        <Input
          id="avatar-zoom"
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          disabled={busy}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setZoom(event.target.valueAsNumber);
          }}
        />
      </label>

      {cropError || errorMessage ? (
        <p className="text-sm text-destructive">
          {errorMessage ?? t("profile.avatarError")}
        </p>
      ) : null}

      <Dialog.Footer>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onCancel}
        >
          {t("actions.cancel")}
        </Button>
        <Button
          type="button"
          disabled={busy || !croppedAreaPixels}
          aria-busy={busy}
          onClick={() => {
            void handleConfirm();
          }}
        >
          {busy ? <Spin size="sm" variant="current" /> : null}
          {t("profile.cropConfirm")}
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  );
}
