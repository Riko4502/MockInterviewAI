/** Передаёт ошибки транспортного слоя смонтированному интерфейсу без импорта React в HTTP-код. */
const listeners = new Set<() => void>();

export function subscribeToForbidden(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyForbidden(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Ошибки уведомления не должны подменять исходную HTTP-ошибку.
    }
  }
}
