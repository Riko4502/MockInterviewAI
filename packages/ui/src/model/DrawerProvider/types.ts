/**
 * Запись об открытой шторке в стеке.
 */
export interface DrawerEntry<T = unknown> {
  name: string;
  payload?: T;
}

/**
 * Контроллер управления шторками (Drawer).
 */
export interface DrawerController<TDefaultPayload = unknown> {
  open: <T = TDefaultPayload>(name: string, payload?: T) => void;
  close: (name: string) => void;
  allClose: () => void;
  get: <T = TDefaultPayload>(name: string) => T | undefined;
  isOpen: (name: string) => boolean;
}
