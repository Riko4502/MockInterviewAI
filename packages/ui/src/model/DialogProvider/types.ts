export type DialogName =
  | "profile"
  | "setting_profile"
  | "setting_menu"
  | "confirm-delete";

export interface DialogEntry {
  name: DialogName;
  payload?: unknown;
}

export interface DialogController {
  open: <T = unknown>(name: DialogName, payload?: T) => void;
  close: (name: DialogName) => void;
  allClose: () => void;
  get: <T = unknown>(name: DialogName) => T | undefined;
  isOpen: (name: DialogName) => boolean;
}
