import type { MediaSettings } from "./types";

export const DEFAULT_MEDIA_SETTINGS: MediaSettings = {
  audioInputId: "",
  audioOutputId: "",
  videoInputId: "",
  preferredAudioInputLabel: null,
  preferredAudioOutputLabel: null,
  preferredVideoInputLabel: null,
  audioVolume: 80,
  speechVolume: 80,
  micGain: 100,
};

const STORAGE_KEY = "mockinterview_media_settings";
const CLIENT_ID_KEY = "mockinterview_client_device_id";

export function getClientDeviceId(): string {
  if (typeof window === "undefined") {
    return "server-client";
  }
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `client_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return "fallback-client";
  }
}

export function getDeviceName(): string {
  if (typeof navigator === "undefined") {
    return "Unknown Device";
  }
  const ua = navigator.userAgent;
  let os = "Desktop";
  if (ua.includes("Win")) os = "Windows";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  let browser = "Browser";
  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";

  return `${os} · ${browser}`;
}

export function loadStoredMediaSettings(): MediaSettings {
  if (typeof window === "undefined") {
    return DEFAULT_MEDIA_SETTINGS;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MEDIA_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<MediaSettings>;
    return {
      audioInputId:
        typeof parsed.audioInputId === "string" ? parsed.audioInputId : "",
      audioOutputId:
        typeof parsed.audioOutputId === "string" ? parsed.audioOutputId : "",
      videoInputId:
        typeof parsed.videoInputId === "string" ? parsed.videoInputId : "",
      preferredAudioInputLabel:
        typeof parsed.preferredAudioInputLabel === "string"
          ? parsed.preferredAudioInputLabel
          : null,
      preferredAudioOutputLabel:
        typeof parsed.preferredAudioOutputLabel === "string"
          ? parsed.preferredAudioOutputLabel
          : null,
      preferredVideoInputLabel:
        typeof parsed.preferredVideoInputLabel === "string"
          ? parsed.preferredVideoInputLabel
          : null,
      audioVolume:
        typeof parsed.audioVolume === "number" &&
        !Number.isNaN(parsed.audioVolume)
          ? Math.max(0, Math.min(100, parsed.audioVolume))
          : DEFAULT_MEDIA_SETTINGS.audioVolume,
      speechVolume:
        typeof parsed.speechVolume === "number" &&
        !Number.isNaN(parsed.speechVolume)
          ? Math.max(0, Math.min(100, parsed.speechVolume))
          : DEFAULT_MEDIA_SETTINGS.speechVolume,
      micGain:
        typeof parsed.micGain === "number" && !Number.isNaN(parsed.micGain)
          ? Math.max(0, Math.min(100, parsed.micGain))
          : DEFAULT_MEDIA_SETTINGS.micGain,
    };
  } catch {
    return DEFAULT_MEDIA_SETTINGS;
  }
}

export function saveStoredMediaSettings(settings: MediaSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn("[MediaSettings] Failed to save to localStorage:", err);
  }
}
