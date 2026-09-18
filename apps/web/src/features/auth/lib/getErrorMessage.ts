type ApiErrorData = {
  message?: string | Record<string, string>;
  [key: string]: unknown;
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

  if (
    httpError.data &&
    typeof httpError.data === "object" &&
    !("message" in httpError.data)
  ) {
    const values = Object.values(httpError.data).filter(
      (v): v is string => typeof v === "string" && Boolean(v.trim()),
    );
    if (values.length > 0) {
      return values.join(". ");
    }
  }

  return httpError.message || fallback;
}
