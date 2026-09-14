"use client";

import { useState } from "react";
import { useAudioVolumeMeter } from "../lib/useAudioVolumeMeter";
import type { ConnectionState } from "../lib/useWebRTC";
import { SandboxVideoWidgetControls } from "./SandboxVideoWidgetControls";
import { SandboxVideoWidgetHeader } from "./SandboxVideoWidgetHeader";
import { SandboxVideoWidgetScreen } from "./SandboxVideoWidgetScreen";

interface SandboxVideoWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: ConnectionState;
  isInCall: boolean;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  callError: string | null;
  onStartCall: () => void;
  onEndCall: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  peerName?: string;
  hasPeerOnline: boolean;
  onCopyInvite?: () => void;
  isInviteCopied?: boolean;
}

export function SandboxVideoWidget({
  isOpen,
  onClose,
  localStream,
  remoteStream,
  connectionState,
  isInCall,
  isAudioMuted,
  isVideoOff,
  isScreenSharing,
  callError,
  onStartCall,
  onEndCall,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  peerName = "Собеседник",
  hasPeerOnline,
  onCopyInvite,
  isInviteCopied,
}: SandboxVideoWidgetProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  const localAudioLevel = useAudioVolumeMeter(localStream, isAudioMuted);
  const remoteAudioLevel = useAudioVolumeMeter(remoteStream, false);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed right-6 bottom-6 z-50 overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur-xl transition-all duration-300 ${
        isMinimized ? "w-72" : "w-96"
      }`}
    >
      <SandboxVideoWidgetHeader
        isInCall={isInCall}
        hasPeerOnline={hasPeerOnline}
        remoteStream={remoteStream}
        connectionState={connectionState}
        isMinimized={isMinimized}
        onToggleMinimize={() => setIsMinimized((prev) => !prev)}
        onClose={onClose}
      />

      {!isMinimized && (
        <SandboxVideoWidgetScreen
          localStream={localStream}
          remoteStream={remoteStream}
          connectionState={connectionState}
          isInCall={isInCall}
          isAudioMuted={isAudioMuted}
          isVideoOff={isVideoOff}
          callError={callError}
          peerName={peerName}
          hasPeerOnline={hasPeerOnline}
          localAudioLevel={localAudioLevel}
          remoteAudioLevel={remoteAudioLevel}
          onCopyInvite={onCopyInvite}
          isInviteCopied={isInviteCopied}
        />
      )}

      <SandboxVideoWidgetControls
        localStream={localStream}
        remoteStream={remoteStream}
        isInCall={isInCall}
        isAudioMuted={isAudioMuted}
        isVideoOff={isVideoOff}
        isScreenSharing={isScreenSharing}
        connectionState={connectionState}
        hasPeerOnline={hasPeerOnline}
        onStartCall={onStartCall}
        onEndCall={onEndCall}
        onToggleAudio={onToggleAudio}
        onToggleVideo={onToggleVideo}
        onToggleScreenShare={onToggleScreenShare}
      />
    </div>
  );
}
