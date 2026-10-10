import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import { CodeRunnerService } from "./code-runner.service";

describe("CodeRunnerService", () => {
  let service: CodeRunnerService;
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodeRunnerService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === "codeRunner.url") return "http://test-runner:8090";
              if (key === "codeRunner.authToken") return "secret-token";
              return null;
            },
          },
        },
      ],
    }).compile();

    service = module.get<CodeRunnerService>(CodeRunnerService);
  });

  it("должен успешно выполнять код и маппить stdout в logs", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "SUCCESS",
        stdout: "Result: 42\n",
        stderr: "",
        exitCode: 0,
        executionTimeMs: 15,
        memoryUsageBytes: 1024,
      }),
    } as Response);

    const result = await service.runCode({
      code: "console.log('Result: 42')",
      language: "typescript",
      stdin: "",
      timeoutMs: 0,
    });

    expect(result.success).toBe(true);
    expect(result.logs).toEqual(["Result: 42"]);
    expect(result.totalTimeMs).toBe(15);
    expect(result.status).toBe("SUCCESS");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://test-runner:8090/api/v1/run",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Token": "secret-token",
        },
      }),
    );
  });

  it("должен маппить stderr с префиксом [ERROR] при ошибках выполнения", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "RUNTIME_ERROR",
        stdout: "",
        stderr: "ReferenceError: x is not defined\n",
        exitCode: 1,
        executionTimeMs: 10,
        memoryUsageBytes: 1024,
      }),
    } as Response);

    const result = await service.runCode({
      code: "console.log(x)",
      language: "javascript",
      stdin: "",
      timeoutMs: 0,
    });

    expect(result.success).toBe(false);
    expect(result.logs).toContain("[ERROR] ReferenceError: x is not defined");
    expect(result.status).toBe("RUNTIME_ERROR");
  });

  it("должен обрабатывать недоступность сервиса code-runner без падения", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:8090"));

    const result = await service.runCode({
      code: "print(1)",
      language: "python",
      stdin: "",
      timeoutMs: 0,
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe("SERVICE_UNAVAILABLE");
    expect(result.logs[0]).toContain("could not connect to code-runner");
  });
});
