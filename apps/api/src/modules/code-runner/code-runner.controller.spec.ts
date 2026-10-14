import { Test, type TestingModule } from "@nestjs/testing";
import type { RunCodeRequestDto, RunCodeResponseDto } from "@packages/dto";
import { CodeRunnerController } from "./code-runner.controller";
import { CodeRunnerService } from "./code-runner.service";

describe("CodeRunnerController", () => {
  let controller: CodeRunnerController;
  let service: CodeRunnerService;

  const mockResponse: RunCodeResponseDto = {
    success: true,
    totalTests: 0,
    passedTests: 0,
    results: [],
    logs: ["Hello, world!"],
    totalTimeMs: 12,
    status: "SUCCESS",
    exitCode: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CodeRunnerController],
      providers: [
        {
          provide: CodeRunnerService,
          useValue: {
            runCode: jest.fn().mockResolvedValue(mockResponse),
          },
        },
      ],
    }).compile();

    controller = module.get<CodeRunnerController>(CodeRunnerController);
    service = module.get<CodeRunnerService>(CodeRunnerService);
  });

  it("должен вызывать codeRunnerService.runCode с переданным DTO", async () => {
    const dto: RunCodeRequestDto = {
      code: "console.log('Hello, world!')",
      language: "typescript",
      stdin: "",
      timeoutMs: 0,
    };

    const result = await controller.run(dto);

    expect(result).toEqual(mockResponse);
    expect(service.runCode).toHaveBeenCalledWith(dto);
  });
});
