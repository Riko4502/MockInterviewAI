"use client";

import { useEffect, useRef, useState } from "react";

export type MediaCheckStatus =
  | "idle"
  | "checking"
  | "granted"
  | "denied"
  | "missing"
  | "busy"
  | "unsupported"
  | "error";
interface DeviceCheck {
  status: MediaCheckStatus;
  label?: string;
}
interface MediaCheck {
  camera: DeviceCheck;
  microphone: DeviceCheck;
}
const initial: MediaCheck = {
  camera: { status: "idle" },
  microphone: { status: "idle" },
};

function errorStatus(error: unknown): MediaCheckStatus {
  const name =
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof error.name === "string"
      ? error.name
      : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "missing";
  if (name === "NotReadableError" || name === "AbortError") return "busy";
  return "error";
}

export function useQuickMediaCheck(open: boolean) {
  const [devices, setDevices] = useState<MediaCheck>(initial);
  const [attempt, setAttempt] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt намеренно перезапускает проверку разрешений и освобождает предыдущие потоки.
  useEffect(() => {
    if (!open) {
      setDevices(initial);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setDevices({
        camera: { status: "unsupported" },
        microphone: { status: "unsupported" },
      });
      return;
    }
    let cancelled = false;
    const streams: MediaStream[] = [];
    let video = videoRef.current;
    setDevices({
      camera: { status: "checking" },
      microphone: { status: "checking" },
    });

    async function check(kind: keyof MediaCheck) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: kind === "camera",
          audio: kind === "microphone",
        });
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        streams.push(stream);
        const track =
          kind === "camera"
            ? stream.getVideoTracks()[0]
            : stream.getAudioTracks()[0];
        setDevices((previous) => ({
          ...previous,
          [kind]: track
            ? { status: "granted", label: track.label }
            : { status: "missing" },
        }));
        if (kind === "camera") video = videoRef.current;
        if (kind === "camera" && video) {
          video.srcObject = stream;
          void video.play().catch(() => {});
        }
      } catch (error) {
        if (!cancelled)
          setDevices((previous) => ({
            ...previous,
            [kind]: { status: errorStatus(error) },
          }));
      }
    }
    void check("camera");
    void check("microphone");
    return () => {
      cancelled = true;
      for (const stream of streams)
        for (const track of stream.getTracks()) track.stop();
      if (video) video.srcObject = null;
    };
  }, [open, attempt]);

  return {
    ...devices,
    videoRef,
    retry: () => setAttempt((value) => value + 1),
  };
}
