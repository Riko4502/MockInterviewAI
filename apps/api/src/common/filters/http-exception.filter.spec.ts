import type { ArgumentsHost } from "@nestjs/common";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { HttpExceptionFilter } from "./http-exception.filter";

function createArgumentsHost() {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn();
  return {
    host: {
      switchToHttp: () => ({
        getResponse: () => ({ status, json }),
      }),
    } as unknown as ArgumentsHost,
    json,
    status,
  };
}

describe("HttpExceptionFilter", () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  it("строковое тело HttpException прокидывается как message", () => {
    const { host, status, json } = createArgumentsHost();

    filter.catch(new ForbiddenException("Origin not allowed"), host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      statusCode: 403,
      message: "Origin not allowed",
      error: "Forbidden",
    });
  });

  it("ошибка валидации { field: message } прокидывается без маскировки", () => {
    const { host, json } = createArgumentsHost();

    filter.catch(
      new BadRequestException({
        email: "Invalid email format",
        password: "String must contain at least 12 character(s)",
      }),
      host,
    );

    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      message: {
        email: "Invalid email format",
        password: "String must contain at least 12 character(s)",
      },
    });
  });

  it("объект с нестроковыми значениями и без message маскируется до Unknown error", () => {
    const { host, json } = createArgumentsHost();

    filter.catch(new BadRequestException({ internalDetail: 123 }), host);

    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      message: "Unknown error",
    });
  });

  it("необработанное исключение -> 500 Internal server error без деталей", () => {
    const { host, json } = createArgumentsHost();

    filter.catch(new Error("Prisma connection refused"), host);

    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: "Internal server error",
      error: "Internal Server Error",
    });
  });
});
