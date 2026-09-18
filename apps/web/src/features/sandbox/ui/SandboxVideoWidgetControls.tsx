"use client";

import {
  CameraIcon,
  CloseIcon,
  EyeIcon,
  EyeOffIcon,
  MicIcon,
  ScreenIcon,
} from "@packages/icons";
import { Button } from "@packages/ui";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { useSandboxMedia } from "../model/SandboxMediaContext";

export function SandboxVideoWidgetControls() {
  const { t } = useTranslation("interview");
  const {
    localStream,
    isInCall,
    isAudioMuted,
    isVideoOff,
    isScreenSharing,
    connectionState,
    hasPeerOnline,
    onStartCall,
    onEndCall,
    onToggleAudio,
    onToggleVideo,
    onToggleScreenShare,
  } = useSandboxMedia();
  return (
    <div className="flex items-center justify-between border-t border-border/80 bg-muted/20 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        {isInCall || localStream ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={onEndCall}
            className="h-8 gap-1.5 px-3 text-xs shadow-xs"
            title={t("sandbox.videoWidget.controls.endCallTooltip")}
          >
            <CloseIcon className="size-3.5" />
            {t("sandbox.videoWidget.controls.endCall")}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={onStartCall}
            disabled={connectionState === "calling"}
            className="h-8 gap-1.5 bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-700 shadow-xs"
            title={t("sandbox.videoWidget.controls.startCallTooltip")}
          >
            <CameraIcon className="size-3.5" />
            {connectionState === "calling"
              ? t("sandbox.videoWidget.controls.calling")
              : t("sandbox.videoWidget.controls.startCall")}
          </Button>
        )}

        {(isInCall || localStream) && (
          <>
            <Button
              variant={isAudioMuted ? "destructive" : "outline"}
              size="sm"
              onClick={onToggleAudio}
              className="h-8 gap-1 px-2 text-xs"
              title={
                isAudioMuted
                  ? t("sandbox.videoWidget.controls.unmuteMicTooltip")
                  : t("sandbox.videoWidget.controls.muteMicTooltip")
              }
            >
              <MicIcon className="size-3.5" />
              {isAudioMuted
                ? t("sandbox.videoWidget.controls.micMuted")
                : t("sandbox.videoWidget.controls.micOn")}
            </Button>

            <Button
              variant={isVideoOff ? "destructive" : "outline"}
              size="sm"
              onClick={onToggleVideo}
              className="h-8 px-2 text-xs"
              title={
                isVideoOff
                  ? t("sandbox.videoWidget.controls.turnOnCamTooltip")
                  : t("sandbox.videoWidget.controls.turnOffCamTooltip")
              }
            >
              {isVideoOff ? (
                <EyeOffIcon className="size-3.5" />
              ) : (
                <EyeIcon className="size-3.5" />
              )}
            </Button>

            <Button
              variant={isScreenSharing ? "primary" : "outline"}
              size="sm"
              onClick={onToggleScreenShare}
              className={`h-8 gap-1 px-2 text-xs ${
                isScreenSharing
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : ""
              }`}
              title={t("sandbox.videoWidget.controls.screenShareTooltip")}
            >
              <ScreenIcon className="size-3.5" />
              {t("sandbox.videoWidget.controls.screenShare")}
            </Button>
          </>
        )}
      </div>

      <span className="text-[11px] font-medium text-muted-foreground">
        {connectionState === "connected"
          ? t("sandbox.videoWidget.controls.statusInCall")
          : connectionState === "calling"
            ? t("sandbox.videoWidget.controls.statusCalling")
            : hasPeerOnline
              ? t("sandbox.videoWidget.controls.statusPeerWaiting")
              : t("sandbox.videoWidget.controls.statusAlone")}
      </span>
    </div>
  );
}
