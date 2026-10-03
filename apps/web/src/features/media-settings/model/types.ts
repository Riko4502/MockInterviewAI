export interface MediaSettings {
  audioInputId: string;
  audioOutputId: string;
  videoInputId: string;
  preferredAudioInputLabel?: string | null;
  preferredAudioOutputLabel?: string | null;
  preferredVideoInputLabel?: string | null;
  audioVolume: number; // 0 to 100
  speechVolume: number; // 0 to 100
  micGain: number; // 0 to 100
}

export interface MediaSettingsContextValue extends MediaSettings {
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  isSinkIdSupported: boolean;
  setAudioInputId: (id: string) => void;
  setAudioOutputId: (id: string) => void;
  setVideoInputId: (id: string) => void;
  setAudioVolume: (vol: number) => void;
  setSpeechVolume: (vol: number) => void;
  setMicGain: (gain: number) => void;
  refreshDevices: () => Promise<void>;
  playTestSound: () => void;
  isPlayingTestSound: boolean;
}
