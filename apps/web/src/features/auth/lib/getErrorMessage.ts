type ApiErrorData = {
  message?: string | Record<string, string>;
};

type HttpErrorLike = {
  message?: string;
  data?: ApiErrorData;
};

export function getErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") {
    return fallback;
  }

  const httpError = error as HttpErrorLike;
  const apiMessage = httpError.data?.message;

  if (typeof apiMessage === "string") {
    return apiMessage;
  }

  if (apiMessage && typeof apiMessage === "object") {
    return Object.values(apiMessage).filter(Boolean).join(". ") || fallback;
  }

  return httpError.message || fallback;
}
