"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WebRTCSignal } from "../model/types";

export type ConnectionState = "idle" | "calling" | "connected" | "ended";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

function createSyntheticMediaStream(label: string): {
  stream: MediaStream;
  audioCtx: AudioContext | null;
} {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.arc(320, 200, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, 320, 310);
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = "#a1a1aa";
    ctx.fillText("Live WebRTC Stream", 320, 340);
  }

  const stream = canvas.captureStream
    ? canvas.captureStream(20)
    : new MediaStream();

  let audioCtx: AudioContext | null = null;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (AudioCtx) {
      audioCtx = new AudioCtx();
      const dest = audioCtx.createMediaStreamDestination();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      gain.gain.value = 0.001; // минимальный уровень сигнала
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      for (const track of dest.stream.getAudioTracks()) {
        stream.addTrack(track);
      }
    }
  } catch {
    // Игнорируем ошибки генерации аудио
  }

  return { stream, audioCtx };
}

interface UseWebRTCOptions {
  userId: string;
  onSendSignal: (signal: WebRTCSignal) => void;
}

export function useWebRTC({ userId, onSendSignal }: UseWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [isRemoteAudioMuted, setIsRemoteAudioMuted] = useState(true);
  const [isRemoteVideoOff, setIsRemoteVideoOff] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const syntheticAudioCtxRef = useRef<AudioContext | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  const onSendSignalRef = useRef(onSendSignal);
  useEffect(() => {
    onSendSignalRef.current = onSendSignal;
  }, [onSendSignal]);

  // Захват локального потока (камера + микрофон) с надежным фолбэком
  const getLocalMedia = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      // По умолчанию микрофон и камера выключены
      for (const track of stream.getAudioTracks()) {
        track.enabled = false;
      }
      for (const track of stream.getVideoTracks()) {
        track.enabled = false;
      }

      localStreamRef.current = stream;
      cameraTrackRef.current = stream.getVideoTracks()[0] ?? null;
      setLocalStream(stream);
      return stream;
    } catch {
      // Фолбэк при блокировке устройства или отсутствии веб-камеры
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const { stream: synthetic, audioCtx } =
          createSyntheticMediaStream("Камера (Аудио)");

        // Останавливаем и удаляем синтетический аудиотрек, освобождаем audioCtx
        for (const synthAudioTrack of synthetic.getAudioTracks()) {
          synthAudioTrack.stop();
          synthetic.removeTrack(synthAudioTrack);
        }
        if (audioCtx) {
          void audioCtx.close();
        }

        for (const track of audioStream.getAudioTracks()) {
          track.enabled = false;
          synthetic.addTrack(track);
        }
        for (const track of synthetic.getVideoTracks()) {
          track.enabled = false;
        }
        localStreamRef.current = synthetic;
        cameraTrackRef.current = synthetic.getVideoTracks()[0] ?? null;
        setLocalStream(synthetic);
        return synthetic;
      } catch {
        const { stream: synthetic, audioCtx } =
          createSyntheticMediaStream("Live Видео");
        syntheticAudioCtxRef.current = audioCtx;
        for (const track of synthetic.getTracks()) {
          track.enabled = false;
        }
        localStreamRef.current = synthetic;
        cameraTrackRef.current = synthetic.getVideoTracks()[0] ?? null;
        setLocalStream(synthetic);
        return synthetic;
      }
    }
  }, []);

  // Инициализация RTCPeerConnection
  const createPeerConnection = useCallback(() => {
    if (pcRef.current) {
      return pcRef.current;
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        onSendSignalRef.current({
          type: "ice-candidate",
          candidate: event.candidate.toJSON(),
          senderId: userId,
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams?.[0]) {
        setRemoteStream(event.streams[0]);
      } else {
        const stream = new MediaStream([event.track]);
        setRemoteStream(stream);
      }
      setConnectionState("connected");
    };

    pc.oniceconnectionstatechange = () => {
      if (
        pc.iceConnectionState === "disconnected" ||
        pc.iceConnectionState === "failed"
      ) {
        setConnectionState("ended");
      } else if (
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed"
      ) {
        setConnectionState("connected");
      }
    };

    return pc;
  }, [userId]);

  // Запуск звонка
  const startCall = useCallback(async () => {
    setCallError(null);
    setConnectionState("calling");

    try {
      const stream = await getLocalMedia();
      const pc = createPeerConnection();

      for (const track of stream.getTracks()) {
        const senders = pc.getSenders();
        const exists = senders.some((s) => s.track === track);
        if (!exists) {
          pc.addTrack(track, stream);
        }
      }

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      onSendSignalRef.current({
        type: "offer",
        sdp: offer,
        senderId: userId,
      });
    } catch (err) {
      setConnectionState("idle");
      const msg = err instanceof Error ? err.message : "Ошибка запуска звонка";
      setCallError(msg);
    }
  }, [getLocalMedia, createPeerConnection, userId]);

  // Завершение звонка
  const endCall = useCallback(() => {
    if (connectionState !== "idle") {
      onSendSignalRef.current({
        type: "call-ended",
        senderId: userId,
      });
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }

    if (
      syntheticAudioCtxRef.current &&
      syntheticAudioCtxRef.current.state !== "closed"
    ) {
      void syntheticAudioCtxRef.current.close().catch(() => {});
      syntheticAudioCtxRef.current = null;
    }

    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        track.stop();
      }
      localStreamRef.current = null;
      cameraTrackRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setConnectionState("idle");
    setIsScreenSharing(false);
    setIsAudioMuted(true);
    setIsVideoOff(true);
    setIsRemoteAudioMuted(true);
    setIsRemoteVideoOff(true);
    pendingCandidates.current = [];
  }, [connectionState, userId]);

  // Обработка входящих WebRTC сигналов
  const handleSignal = useCallback(
    async (signal: WebRTCSignal) => {
      if (signal.senderId === userId) return;

      try {
        switch (signal.type) {
          case "media-state": {
            setIsRemoteAudioMuted(signal.isAudioMuted);
            setIsRemoteVideoOff(signal.isVideoOff);
            break;
          }

          case "offer": {
            setConnectionState("calling");
            const stream = await getLocalMedia();
            const pc = createPeerConnection();

            for (const track of stream.getTracks()) {
              const senders = pc.getSenders();
              const exists = senders.some((s) => s.track === track);
              if (!exists) {
                pc.addTrack(track, stream);
              }
            }

            if (pc.signalingState !== "stable") {
              try {
                await Promise.all([
                  pc.setLocalDescription({ type: "rollback" }),
                  pc.setRemoteDescription(
                    new RTCSessionDescription(signal.sdp),
                  ),
                ]);
              } catch {
                await pc.setRemoteDescription(
                  new RTCSessionDescription(signal.sdp),
                );
              }
            } else {
              await pc.setRemoteDescription(
                new RTCSessionDescription(signal.sdp),
              );
            }

            // Применяем отложенные ICE-кандидаты
            for (const cand of pendingCandidates.current) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch {
                // Игнорируем
              }
            }
            pendingCandidates.current = [];

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            onSendSignalRef.current({
              type: "answer",
              sdp: answer,
              senderId: userId,
            });
            onSendSignalRef.current({
              type: "media-state",
              isAudioMuted,
              isVideoOff,
              senderId: userId,
            });
            setConnectionState("connected");
            break;
          }

          case "answer": {
            if (pcRef.current && pcRef.current.signalingState !== "stable") {
              await pcRef.current.setRemoteDescription(
                new RTCSessionDescription(signal.sdp),
              );

              for (const cand of pendingCandidates.current) {
                try {
                  await pcRef.current.addIceCandidate(
                    new RTCIceCandidate(cand),
                  );
                } catch {
                  // Игнорируем
                }
              }
              pendingCandidates.current = [];
              setConnectionState("connected");
            }
            break;
          }

          case "ice-candidate": {
            if (pcRef.current?.remoteDescription) {
              try {
                await pcRef.current.addIceCandidate(
                  new RTCIceCandidate(signal.candidate),
                );
              } catch {
                // Игнорируем
              }
            } else {
              pendingCandidates.current.push(signal.candidate);
            }
            break;
          }

          case "call-ended": {
            if (pcRef.current) {
              pcRef.current.close();
              pcRef.current = null;
            }
            setRemoteStream(null);
            setIsRemoteAudioMuted(true);
            setIsRemoteVideoOff(true);
            setConnectionState("ended");
            break;
          }

          case "call-started":
            // LiveKit / WebRTC сигналинг обрабатывается на уровне SandboxRoom
            break;
        }
      } catch (err) {
        console.error("[useWebRTC] Error handling signal:", err);
      }
    },
    [userId, getLocalMedia, createPeerConnection, isAudioMuted, isVideoOff],
  );

  // Переключение микрофона
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const nextEnabled = !audioTrack.enabled;
        audioTrack.enabled = nextEnabled;
        const nextMuted = !nextEnabled;
        setIsAudioMuted(nextMuted);
        onSendSignalRef.current({
          type: "media-state",
          isAudioMuted: nextMuted,
          isVideoOff,
          senderId: userId,
        });
      }
    }
  }, [isVideoOff, userId]);

  // Переключение камеры
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        const nextEnabled = !videoTrack.enabled;
        videoTrack.enabled = nextEnabled;
        const nextOff = !nextEnabled;
        setIsVideoOff(nextOff);
        onSendSignalRef.current({
          type: "media-state",
          isAudioMuted,
          isVideoOff: nextOff,
          senderId: userId,
        });
      }
    }
  }, [isAudioMuted, userId]);

  // Демонстрация экрана
  const toggleScreenShare = useCallback(async () => {
    if (!pcRef.current || !localStreamRef.current) return;

    if (isScreenSharing) {
      if (cameraTrackRef.current) {
        const senders = pcRef.current.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === "video");
        if (videoSender) {
          await videoSender.replaceTrack(cameraTrackRef.current);
        }
      }
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        const screenTrack = screenStream.getVideoTracks()[0];
        if (!screenTrack) return;

        screenTrack.onended = () => {
          void (async () => {
            const pc = pcRef.current;
            if (pc && cameraTrackRef.current) {
              const videoSender = pc
                .getSenders()
                .find((s) => s.track?.kind === "video");
              await videoSender?.replaceTrack(cameraTrackRef.current);
            }
            screenTrackRef.current = null;
            setIsScreenSharing(false);
          })();
        };

        const senders = pcRef.current.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === "video");
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        }

        screenTrackRef.current = screenTrack;
        setIsScreenSharing(true);
      } catch {
        // Отмена пользователем
      }
    }
  }, [isScreenSharing]);

  const endCallRef = useRef(endCall);
  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);

  useEffect(() => {
    return () => {
      endCallRef.current();
    };
  }, []);

  return {
    localStream,
    remoteStream,
    connectionState,
    isInCall: connectionState === "connected" || connectionState === "calling",
    isAudioMuted,
    isVideoOff,
    isRemoteAudioMuted,
    isRemoteVideoOff,
    isScreenSharing,
    callError,
    startCall,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    handleSignal,
  };
}
