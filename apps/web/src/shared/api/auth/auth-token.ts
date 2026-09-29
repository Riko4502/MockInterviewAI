let accessToken: string | null = null;

const listeners = new Set<() => void>();

export const authToken = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  get(): string | null {
    return accessToken;
  },

  set(token: string): void {
    accessToken = token;
    for (const listener of listeners) listener();
  },

  clear(): void {
    accessToken = null;
    for (const listener of listeners) listener();
  },
};
