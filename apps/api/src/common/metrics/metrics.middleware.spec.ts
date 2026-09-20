import { EventEmitter } from "node:events";

import type { NextFunction, Request, Response } from "express";
import { MetricsMiddleware } from "./metrics.middleware";

class FakeResponse extends EventEmitter {
  statusCode = 200;
  writableFinished = true;

  finish(): void {
    this.emit("finish");
  }

  close(): void {
    this.emit("close");
  }
}

function createRequest(partial: Partial<Request>): Request {
  return { route: undefined, ...partial } as unknown as Request;
}

describe("MetricsMiddleware", () => {
  let requestFinished: jest.Mock;
  let requestStarted: jest.Mock;
  let requestAborted: jest.Mock;
  let middleware: MetricsMiddleware;

  beforeEach(() => {
    requestFinished = jest.fn();
    requestStarted = jest.fn();
    requestAborted = jest.fn();
    middleware = new MetricsMiddleware({
      requestFinished,
      requestStarted,
      requestAborted,
      // biome-ignore lint/suspicious/noExplicitAny: partial mock
    } as any);
  });

  it("учитывает запрос сразу и финализирует по finish с маршрутом и статусом", () => {
    const req = createRequest({
      method: "GET",
      route: { path: "/api/v1/health" },
    });
    const res = new FakeResponse();
    const next = jest.fn();

    middleware.use(
      req,
      res as unknown as Response,
      next as unknown as NextFunction,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(requestStarted).toHaveBeenCalledTimes(1);

    res.statusCode = 204;
    res.finish();

    expect(requestFinished).toHaveBeenCalledTimes(1);
    expect(requestFinished).toHaveBeenCalledWith(
      { method: "GET", route: "/api/v1/health", statusCode: 204 },
      expect.any(Number),
    );
  });

  it("учитывает запрос, отклонённый guard-ом до обработчика (401)", () => {
    const req = createRequest({
      method: "GET",
      route: { path: "/api/v1/users/42" },
    });
    const res = new FakeResponse();

    middleware.use(
      req,
      res as unknown as Response,
      jest.fn() as unknown as NextFunction,
    );

    res.statusCode = 401;
    res.finish();

    expect(requestStarted).toHaveBeenCalledTimes(1);
    expect(requestFinished).toHaveBeenCalledWith(
      { method: "GET", route: "/api/v1/users/42", statusCode: 401 },
      expect.any(Number),
    );
  });

  it("не дублирует финализацию при finish + close", () => {
    const req = createRequest({ method: "GET", route: { path: "/api/v1/x" } });
    const res = new FakeResponse();

    middleware.use(
      req,
      res as unknown as Response,
      jest.fn() as unknown as NextFunction,
    );

    res.finish();
    res.close();

    expect(requestFinished).toHaveBeenCalledTimes(1);
    expect(requestAborted).not.toHaveBeenCalled();
  });

  it("считает обрыв соединения отдельно, не финализируя ответ", () => {
    const req = createRequest({
      method: "POST",
      route: { path: "/api/v1/jobs" },
    });
    const res = new FakeResponse();
    res.writableFinished = false;

    middleware.use(
      req,
      res as unknown as Response,
      jest.fn() as unknown as NextFunction,
    );

    res.close();

    expect(requestAborted).toHaveBeenCalledTimes(1);
    expect(requestAborted).toHaveBeenCalledWith({
      method: "POST",
      route: "/api/v1/jobs",
    });
    expect(requestFinished).not.toHaveBeenCalled();
  });

  it("не считает close, если ответ уже завершился, дважды", () => {
    const req = createRequest({ method: "GET", route: { path: "/api/v1/x" } });
    const res = new FakeResponse();

    middleware.use(
      req,
      res as unknown as Response,
      jest.fn() as unknown as NextFunction,
    );

    res.close();

    expect(requestAborted).toHaveBeenCalledTimes(0);
    expect(requestFinished).not.toHaveBeenCalled();
  });

  it("для неразрешённого маршрута пишет 'unmatched'", () => {
    const req = createRequest({ method: "GET" });
    const res = new FakeResponse();

    middleware.use(
      req,
      res as unknown as Response,
      jest.fn() as unknown as NextFunction,
    );

    res.statusCode = 404;
    res.finish();

    expect(requestFinished).toHaveBeenCalledWith(
      { method: "GET", route: "unmatched", statusCode: 404 },
      expect.any(Number),
    );
  });
});
