"use client";

import { useEffect, useRef, useState } from "react";

export type MicMeterErrorCode = "ACCESS_DENIED" | "UNSUPPORTED";

export function useMicLevelMeter(
  deviceId: string,
  enabled: boolean,
  gain = 100,
) {
  const [level, setLevel] = useState<number>(0);
  const [errorCode, setErrorCode] = useState<MicMeterErrorCode | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const gainRef = useRef<number>(gain);

  useEffect(() => {
    gainRef.current = gain;
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = Math.max(0, Math.min(100, gain)) / 100;
    }
  }, [gain]);

  useEffect(() => {
    if (
      !enabled ||
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setLevel(0);
      return;
    }

    let isCancelled = false;

    const setupMicMeter = async () => {
      try {
        setErrorCode(null);
        const constraints: MediaStreamConstraints = {
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
          video: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (isCancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }

        streamRef.current = stream;

        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;

        if (!AudioCtx) {
          setErrorCode("UNSUPPORTED");
          return;
        }

        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const gainNode = ctx.createGain();
        gainNode.gain.value = Math.max(0, Math.min(100, gainRef.current)) / 100;
        gainNodeRef.current = gainNode;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.4;
        source.connect(gainNode);
        gainNode.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateMeter = () => {
          if (isCancelled) return;
          analyser.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          // Преобразуем значение 0-255 в 0-100 с масштабированием
          const normalized = Math.min(100, Math.round((average / 128) * 100));
          setLevel(normalized);

          animFrameRef.current = requestAnimationFrame(updateMeter);
        };

        updateMeter();
      } catch (err) {
        if (!isCancelled) {
          console.warn("[useMicLevelMeter] Failed to access mic stream:", err);
          setErrorCode("ACCESS_DENIED");
          setLevel(0);
        }
      }
    };

    void setupMicMeter();

    return () => {
      isCancelled = true;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        void audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      setLevel(0);
    };
  }, [deviceId, enabled]);

  return { level, errorCode, error: errorCode };
}
