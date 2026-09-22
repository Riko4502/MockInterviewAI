let accessToken: string | null = null;

export const authToken = {
  get(): string | null {
    return accessToken;
  },

  set(token: string): void {
    accessToken = token;
  },

  clear(): void {
    accessToken = null;
  },
};
