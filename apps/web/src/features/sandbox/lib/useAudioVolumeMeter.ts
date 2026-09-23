"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Хук для вычисления уровня громкости аудиопотока в процентах (0-100) через Web Audio API.
 */
export function useAudioVolumeMeter(
  stream: MediaStream | null,
  isMuted = false,
): number {
  const [level, setLevel] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || isMuted) {
      setLevel(0);
      return;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      let lastUpdate = 0;
      let lastLevel = 0;

      const loop = () => {
        animFrameRef.current = requestAnimationFrame(loop);
        const now = performance.now();
        if (now - lastUpdate < 80) return;
        lastUpdate = now;

        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;

        const next = Math.min(100, Math.round((avg / 128) * 100));
        if (Math.abs(next - lastLevel) >= 2) {
          lastLevel = next;
          setLevel(next);
        }
      };
      animFrameRef.current = requestAnimationFrame(loop);
    } catch {
      // Игнорируем в средах без аудио API
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [stream, isMuted]);

  return level;
}
