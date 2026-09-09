export interface paths {
  "/api/v1/health": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Проверка состояния приложения (§56) */
    get: operations["HealthController_check"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/auth/register": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Регистрация нового пользователя (§4) */
    post: operations["AuthController_register"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/auth/login": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Вход пользователя (§58) */
    post: operations["AuthController_login"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/auth/logout": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Выход пользователя (§60) */
    post: operations["AuthController_logout"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/v1/auth/refresh": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Обновление токенов — refresh token rotation (§65) */
    post: operations["AuthController_refresh"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: never;
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
  HealthController_check: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Приложение и PostgreSQL доступны. */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            /** @enum {string} */
            status: "ok" | "error";
            /** @enum {string} */
            db: "up" | "down";
          };
        };
      };
      /** @description PostgreSQL недоступен. Детали ошибки только в логах (§56). */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            /** @enum {string} */
            status: "ok" | "error";
            /** @enum {string} */
            db: "up" | "down";
          };
        };
      };
    };
  };
  AuthController_register: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Тело запроса, валидируется соответствующей zod-схемой. */
    requestBody: {
      content: {
        "application/json": {
          /** Format: email */
          email: string;
          password: string;
          passwordConfirmation: string;
        };
      };
    };
    responses: {
      /** @description Успешная регистрация. Set-Cookie: refresh_token={JWT}; HttpOnly; SameSite=Lax; Path=/api/v1/auth; Max-Age=JWT_REFRESH_EXPIRATION (§25–28 SPEC.md). Refresh token не возвращается в JSON response. */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            /** @description JWT access token */
            accessToken: string;
          };
        };
      };
      /** @description Ошибка валидации DTO. */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            /** @example 400 */
            statusCode: number;
            /**
             * @description Карта ошибок `{ field: message }`.
             * @example {
             *       "email": "Некорректный email"
             *     }
             */
            message: {
              [key: string]: string;
            };
          };
        };
      };
      /** @description Email уже зарегистрирован. */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            /** @example 401 */
            statusCode: number;
            /** @example Invalid credentials */
            message: string;
            error?: string;
          };
        };
      };
    };
  };
  AuthController_login: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description Тело запроса, валидируется соответствующей zod-схемой. */
    requestBody: {
      content: {
        "application/json": {
          /** Format: email */
          email: string;
          password: string;
        };
      };
    };
    responses: {
      /** @description Успешный вход. Set-Cookie: refresh_token={JWT}; HttpOnly; SameSite=Lax; Path=/api/v1/auth; Max-Age=JWT_REFRESH_EXPIRATION (§25–28 SPEC.md). Refresh token не возвращается в JSON response. */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            /** @description JWT access token */
            accessToken: string;
          };
        };
      };
      /** @description Ошибка валидации DTO. */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            /** @example 400 */
            statusCode: number;
            /**
             * @description Карта ошибок `{ field: message }`.
             * @example {
             *       "email": "Некорректный email"
             *     }
             */
            message: {
              [key: string]: string;
            };
          };
        };
      };
      /** @description Неверные учётные данные (единый ответ без деталей, §59). */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            /** @example 401 */
            statusCode: number;
            /** @example Invalid credentials */
            message: string;
            error?: string;
          };
        };
      };
    };
  };
  AuthController_logout: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Успешный выход. Set-Cookie: refresh_token=; Expires=в прошлом — cookie сброшена (§60). */
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description Refresh cookie отсутствует/невалиден. Cookie при этом очищается всегда (§60). */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            /** @example 401 */
            statusCode: number;
            /** @example Invalid credentials */
            message: string;
            error?: string;
          };
        };
      };
      /** @description Redis недоступен. Cookie НЕ сбрасывается, чтобы не потерять сессию (§60). */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            /** @example 401 */
            statusCode: number;
            /** @example Invalid credentials */
            message: string;
            error?: string;
          };
        };
      };
    };
  };
  AuthController_refresh: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Успешное обновление. Set-Cookie: refresh_token={JWT}; HttpOnly; SameSite=Lax; Path=/api/v1/auth; Max-Age=JWT_REFRESH_EXPIRATION (§25–28 SPEC.md). Refresh token не возвращается в JSON response. */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            /** @description JWT access token */
            accessToken: string;
          };
        };
      };
      /** @description Refresh cookie отсутствует/невалиден/replay. Cookie при этом очищается always (§65). */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            /** @example 401 */
            statusCode: number;
            /** @example Invalid credentials */
            message: string;
            error?: string;
          };
        };
      };
      /** @description Redis недоступен. Cookie НЕ сбрасывается, чтобы не потерять сессию (§60). */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            /** @example 401 */
            statusCode: number;
            /** @example Invalid credentials */
            message: string;
            error?: string;
          };
        };
      };
    };
  };
}
