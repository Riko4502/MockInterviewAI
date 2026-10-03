"use client";

import {
  getProfileControllerGetDeviceSettingsQueryKey,
  useProfileControllerUpdateDeviceSettings,
} from "@packages/api";
import { Button, Dialog } from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import {
  getClientDeviceId,
  getDeviceName,
} from "../model/mediaSettingsStorage";
import { useQuickMediaCheck } from "../model/useQuickMediaCheck";

export interface QuickMediaCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onCloseAutoFocus?: (event: Event) => void;
}

export function QuickMediaCheckDialog({
  open,
  onOpenChange,
  onSaved,
  onCloseAutoFocus,
}: QuickMediaCheckDialogProps) {
  const { t } = useTranslation("dashboard");
  const id = useId();
  const media = useQuickMediaCheck(open);
  const client = useQueryClient();
  const save = useProfileControllerUpdateDeviceSettings({
    mutation: {
      onSuccess: (saved) => {
        client.setQueryData(
          getProfileControllerGetDeviceSettingsQueryKey({
            clientId: saved.clientId,
          }),
          saved,
        );
        onSaved();
      },
    },
  });
  const checking =
    media.camera.status === "checking" ||
    media.microphone.status === "checking";
  const canSave =
    Boolean(media.camera.label || media.microphone.label) &&
    !checking &&
    !save.isPending;

  function saveDevices() {
    if (!canSave) return;
    save.mutate({
      data: {
        clientId: getClientDeviceId(),
        deviceName: getDeviceName(),
        ...(media.camera.label
          ? { preferredVideoInputLabel: media.camera.label }
          : {}),
        ...(media.microphone.label
          ? { preferredAudioInputLabel: media.microphone.label }
          : {}),
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        showCloseButton={false}
        onCloseAutoFocus={onCloseAutoFocus}
        className="max-h-[90dvh] overflow-y-auto motion-reduce:animate-none"
      >
        <Dialog.Header>
          <Dialog.Title>{t("mediaCheck.title")}</Dialog.Title>
          <Dialog.Description>{t("mediaCheck.description")}</Dialog.Description>
        </Dialog.Header>
        <video
          ref={media.videoRef}
          autoPlay
          muted
          playsInline
          aria-label={t("mediaCheck.preview")}
          className="aspect-video w-full rounded-lg bg-muted object-cover"
        />
        <div className="space-y-3">
          {(["camera", "microphone"] as const).map((kind) => (
            <div key={kind}>
              <p id={`${id}-${kind}`} className="font-medium">
                {t(`mediaCheck.${kind}`)}
              </p>
              <output
                aria-labelledby={`${id}-${kind}`}
                className="block text-sm text-muted-foreground"
              >
                {t(`mediaCheck.status.${media[kind].status}`)}
                {media[kind].label ? ` — ${media[kind].label}` : ""}
              </output>
            </div>
          ))}
        </div>
        {save.isError && (
          <p role="alert" className="text-sm text-destructive">
            {t("mediaCheck.saveError")}
          </p>
        )}
        {save.isSuccess && (
          <output className="text-sm">{t("mediaCheck.saved")}</output>
        )}
        <Dialog.Footer className="flex-wrap">
          <Button
            variant="outline"
            onClick={() => {
              save.reset();
              media.retry();
            }}
            disabled={checking || save.isPending}
          >
            {t("mediaCheck.retry")}
          </Button>
          <Button onClick={saveDevices} disabled={!canSave || save.isSuccess}>
            {save.isPending ? t("loading.mutation") : t("mediaCheck.save")}
          </Button>
          <Dialog.Close asChild>
            <Button variant="ghost">{t("aiDialog.close")}</Button>
          </Dialog.Close>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
