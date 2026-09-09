export interface DialogEntry {
  name: string;
  payload?: unknown;
}

export interface DialogContextValue {
  stack: DialogEntry[];
  open: (name: string, payload?: unknown) => void;
  close: (name: string) => void;
  allClose: () => void;
}

export interface DialogController {
  open: (name: string, payload?: unknown) => void;
  close: (name: string) => void;
  allClose: () => void;
}

export interface DialogState<T> {
  isOpen: boolean;
  isTop: boolean;
  payload: T | undefined;
  open: (data?: T) => void;
  close: () => void;
  allClose: () => void;
}
