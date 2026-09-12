export interface DialogEntry {
  name: string;
  payload?: unknown;
}

export interface DialogController {
  open: <T = unknown>(name: string, payload?: T) => void;
  close: (name: string) => void;
  allClose: () => void;
  get: <T = unknown>(name: string) => T | undefined;
  isOpen: (name: string) => boolean;
}
