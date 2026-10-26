"use client";

import { cn } from "@packages/utils";
import { useEffect, useRef, useState } from "react";

/** Пропсы индикатора громкости микрофона */
export interface MeetingAudioMeterProps {
  /** Локальный MediaStream для анализа уровня звука */
  stream?: MediaStream | null;
  /** Заданный уровень громкости (0-100), если расчет производится во внешнем хуке */
  level?: number;
  /** Дополнительные CSS классы */
  className?: string;
}

/**
 * Индикатор уровня громкости микрофона (Audio Level Meter).
 * Визуализирует уровень входного сигнала в лобби и настройках через Web Audio API.
 */
export function MeetingAudioMeter({
  stream,
  level: externalLevel,
  className,
}: MeetingAudioMeterProps) {
  const [internalLevel, setInternalLevel] = useState<number>(0);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Если уровень передан снаружи или нет стрима/аудиотрека, Web Audio API не запускаем
    if (externalLevel !== undefined || !stream) {
      setInternalLevel(0);
      return;
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack || !audioTrack.enabled) {
      setInternalLevel(0);
      return;
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) return;

    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;

    try {
      audioContext = new AudioContextClass();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;

      source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMeter = () => {
        if (!analyser) return;

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        // Приводим к шкале 0-100 с нормализацией
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        setInternalLevel(normalized);

        animFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch {
      // Игнорируем ошибки инициализации AudioContext
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      source?.disconnect();
      audioContext?.close().catch(() => {});
    };
  }, [stream, externalLevel]);

  const activeLevel =
    externalLevel !== undefined ? externalLevel : internalLevel;

  return (
    <div
      data-slot="meeting-audio-meter"
      className={cn("flex items-center gap-1.5", className)}
    >
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-75",
            activeLevel > 75
              ? "bg-amber-500"
              : activeLevel > 20
                ? "bg-emerald-500"
                : "bg-muted-foreground/30",
          )}
          style={{ width: `${Math.max(2, Math.min(100, activeLevel))}%` }}
        />
      </div>
      <output className="w-8 text-right font-mono text-[10px] text-muted-foreground">
        {activeLevel}%
      </output>
    </div>
  );
}
