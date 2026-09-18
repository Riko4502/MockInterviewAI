"use client";

import { useToast } from "@packages/ui";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLiveKitRoom } from "@/features/realtime";
import { buildAppUrl } from "@/shared/lib/url";
import type { useSandboxRealtime } from "../lib/useSandboxRealtime";
import { type ConnectionState, useWebRTC } from "../lib/useWebRTC";
import { useSandboxStore } from "./useSandboxStore";

export interface SandboxMediaContextValue {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: ConnectionState;
  isCallConnected: boolean;
  isInCall: boolean;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isRemoteVideoOff: boolean;
  isRemoteAudioMuted: boolean;
  isScreenSharing: boolean;
  callError: string | null;
  peerName: string;
  hasPeerOnline: boolean;
  peerCount: number;
  isInviteCopied: boolean;
  onCopyInvite: () => void;
  onStartCall: () => Promise<void>;
  onEndCall: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
}

const SandboxMediaContext = createContext<SandboxMediaContextValue | null>(
  null,
);

export function useSandboxMedia(): SandboxMediaContextValue {
  const context = useContext(SandboxMediaContext);
  if (!context) {
    throw new Error(
      "useSandboxMedia must be used within a SandboxMediaProvider",
    );
  }
  return context;
}

interface SandboxMediaProviderProps {
  roomId: string;
  pathname: string;
  inviteToken?: string;
  realtime: ReturnType<typeof useSandboxRealtime>;
  children: ReactNode;
}

export function SandboxMediaProvider({
  roomId,
  pathname,
  inviteToken,
  realtime,
  children,
}: SandboxMediaProviderProps) {
  const toast = useToast();
  const setIsVideoOpen = useSandboxStore((s) => s.setIsVideoOpen);

  const [isInviteCopied, setIsInviteCopied] = useState<boolean>(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef<boolean>(true);

  // Очистка таймера копирования и инвалидация при unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
    };
  }, []);

  const handleCopyInvite = useCallback(() => {
    if (typeof window === "undefined") return;

    const url = buildAppUrl(pathname, {
      room: roomId,
      ...(inviteToken ? { invite: inviteToken } : {}),
    });
    navigator.clipboard
      .writeText(url)
      .then(() => {
        if (!mountedRef.current) return;

        setIsInviteCopied(true);

        if (copyTimeoutRef.current) {
          clearTimeout(copyTimeoutRef.current);
        }

        copyTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setIsInviteCopied(false);
          }
          copyTimeoutRef.current = null;
        }, 2500);

        toast.push({
          status: "success",
          title: "Ссылка скопирована",
          description: "Отправьте ссылку собеседнику для совместного решения",
          duration: 3000,
        });
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        console.warn("[Sandbox] Clipboard write failed:", err);
        toast.push({
          status: "error",
          title: "Не удалось скопировать ссылку",
          description: "Пожалуйста, скопируйте URL вручную из адресной строки",
          duration: 4000,
        });
      });
  }, [pathname, roomId, inviteToken, toast]);

  // WebRTC P2P видео/аудио звонок
  const webrtc = useWebRTC({
    userId: realtime.userId,
    onSendSignal: (signal) => {
      realtime.broadcastWebRTCSignal(signal);
    },
  });

  // LiveKit SFU видео/аудио интеграция
  const livekit = useLiveKitRoom({
    sessionId: roomId,
  });

  // Связываем сигналы из realtime со звонками
  useEffect(() => {
    return realtime.subscribeWebRTCSignal((signal) => {
      if (signal.type === "call-started" || signal.type === "offer") {
        setIsVideoOpen(true);
      }
      if (signal.type === "call-started") {
        void livekit.connect().catch((err) => {
          console.warn("[SandboxMedia] LiveKit receiver connect failed:", err);
        });
      } else if (signal.type === "call-ended") {
        if (livekit.isConnected || livekit.isConnecting) {
          void livekit.disconnect();
        }
      }
      void webrtc.handleSignal(signal);
    });
  }, [realtime, webrtc, setIsVideoOpen, livekit]);

  const connectionState: ConnectionState = livekit.isConnected
    ? "connected"
    : livekit.isConnecting
      ? "calling"
      : webrtc.connectionState;

  const isCallConnected =
    connectionState === "connected" ||
    Boolean(livekit.remoteStream || webrtc.remoteStream);

  const isInCall = isCallConnected || connectionState === "calling";
  const localStream = livekit.localStream || webrtc.localStream;
  const remoteStream = livekit.remoteStream || webrtc.remoteStream;

  const isAudioMuted = livekit.isConnected
    ? !livekit.isMicrophoneEnabled
    : webrtc.isAudioMuted;

  const isVideoOff = livekit.isConnected
    ? !livekit.isCameraEnabled
    : webrtc.isVideoOff;

  const isRemoteVideoOff = livekit.isConnected
    ? livekit.isRemoteVideoOff
    : webrtc.isRemoteVideoOff;

  const isRemoteAudioMuted = livekit.isConnected
    ? livekit.isRemoteAudioMuted
    : webrtc.isRemoteAudioMuted;

  const isScreenSharing = livekit.isConnected
    ? livekit.isScreenShareEnabled
    : webrtc.isScreenSharing;

  const callError = livekit.isConnected ? livekit.error : webrtc.callError;
  const peerName = realtime.otherPeers[0]?.name || "Собеседник";
  const hasPeerOnline = realtime.peerCount > 1;

  const handleStartCall = useCallback(async () => {
    setIsVideoOpen(true);
    try {
      const connected = await livekit.connect();
      if (connected) {
        realtime.broadcastWebRTCSignal({
          type: "call-started",
          senderId: realtime.userId,
        });
      }
    } catch {
      await webrtc.startCall();
    }
  }, [livekit, realtime, webrtc, setIsVideoOpen]);

  const handleEndCall = useCallback(() => {
    if (livekit.isConnected || livekit.isConnecting) {
      void livekit.disconnect();
    }
    webrtc.endCall();
    realtime.broadcastWebRTCSignal({
      type: "call-ended",
      senderId: realtime.userId,
    });
  }, [livekit, realtime, webrtc]);

  const handleToggleAudio = useCallback(() => {
    if (livekit.isConnected) {
      void livekit.toggleMicrophone();
    } else {
      webrtc.toggleAudio();
    }
  }, [livekit, webrtc]);

  const handleToggleVideo = useCallback(() => {
    if (livekit.isConnected) {
      void livekit.toggleCamera();
    } else {
      webrtc.toggleVideo();
    }
  }, [livekit, webrtc]);

  const handleToggleScreenShare = useCallback(() => {
    if (livekit.isConnected) {
      void livekit.toggleScreenShare();
    } else {
      void webrtc.toggleScreenShare();
    }
  }, [livekit, webrtc]);

  const value = useMemo<SandboxMediaContextValue>(
    () => ({
      localStream,
      remoteStream,
      connectionState,
      isCallConnected,
      isInCall,
      isAudioMuted,
      isVideoOff,
      isRemoteVideoOff,
      isRemoteAudioMuted,
      isScreenSharing,
      callError,
      peerName,
      hasPeerOnline,
      peerCount: realtime.peerCount,
      isInviteCopied,
      onCopyInvite: handleCopyInvite,
      onStartCall: handleStartCall,
      onEndCall: handleEndCall,
      onToggleAudio: handleToggleAudio,
      onToggleVideo: handleToggleVideo,
      onToggleScreenShare: handleToggleScreenShare,
    }),
    [
      localStream,
      remoteStream,
      connectionState,
      isCallConnected,
      isInCall,
      isAudioMuted,
      isVideoOff,
      isRemoteVideoOff,
      isRemoteAudioMuted,
      isScreenSharing,
      callError,
      peerName,
      hasPeerOnline,
      realtime.peerCount,
      isInviteCopied,
      handleCopyInvite,
      handleStartCall,
      handleEndCall,
      handleToggleAudio,
      handleToggleVideo,
      handleToggleScreenShare,
    ],
  );

  return (
    <SandboxMediaContext.Provider value={value}>
      {children}
    </SandboxMediaContext.Provider>
  );
}
