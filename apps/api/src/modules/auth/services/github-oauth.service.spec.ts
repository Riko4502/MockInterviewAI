import { createHash } from "node:crypto";
import {
  BadGatewayException,
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { RedisService } from "../../../redis/redis.service";
import type { UsersService } from "../../users/users.service";
import { GithubOAuthService } from "./github-oauth.service";

describe("Сервис GitHub OAuth", () => {
  const user = {
    id: "user-1",
    githubId: "123",
    email: "user@example.com",
    passwordHash: null,
    role: null,
    deletedAt: null,
  };
  let service: GithubOAuthService;
  let state: string;
  let browser: string;
  let storage: Map<string, string>;
  let redis: { set: jest.Mock; getdel: jest.Mock };
  let prisma: { user: { findUnique: jest.Mock; updateMany: jest.Mock } };
  let users: {
    findUserWithRoleByEmail: jest.Mock;
    findUserWithRoleById: jest.Mock;
    create: jest.Mock;
  };
  let http: jest.SpyInstance;

  function reply(value: unknown, ok = true) {
    return { ok, json: async () => value } as Response;
  }
  function githubReplies(
    emails: unknown = [
      { email: "USER@example.com", verified: true, primary: true },
    ],
  ) {
    http
      .mockResolvedValueOnce(
        reply({ access_token: "github-secret", token_type: "bearer" }),
      )
      .mockResolvedValueOnce(reply({ id: 123 }))
      .mockResolvedValueOnce(reply(emails));
  }

  beforeEach(async () => {
    storage = new Map();
    redis = {
      set: jest.fn(async (key, value) => {
        storage.set(key, value);
      }),
      getdel: jest.fn(async (key) => {
        const value = storage.get(key) ?? null;
        storage.delete(key);
        return value;
      }),
    };
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    users = {
      findUserWithRoleByEmail: jest.fn().mockResolvedValue(null),
      findUserWithRoleById: jest.fn().mockResolvedValue(user),
      create: jest.fn().mockResolvedValue(user),
    };
    const settings: Record<string, string> = {
      GITHUB_CLIENT_ID: "client-id",
      GITHUB_CLIENT_SECRET: "client-secret",
      GITHUB_CALLBACK_URL:
        "https://api.example.com/api/v1/auth/github/callback",
      FRONTEND_URL: "https://web.example.com",
    };
    service = new GithubOAuthService(
      { get: (key: string) => settings[key] } as ConfigService,
      redis as unknown as RedisService,
      prisma as unknown as PrismaService,
      users as unknown as UsersService,
    );
    http = jest.spyOn(globalThis, "fetch");
    const start = await service.authorize();
    state = new URL(start.url).searchParams.get("state") as string;
    browser = start.browserSecret;
  });
  afterEach(() => jest.restoreAllMocks());

  it("генерирует уникальный state, права доступа, URL возврата и PKCE S256, сохраняет контекст на 300 секунд", async () => {
    const start = await service.authorize();
    const url = new URL(start.url);
    expect(url.origin + url.pathname).toBe(
      "https://github.com/login/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.example.com/api/v1/auth/github/callback",
    );
    expect(url.searchParams.get("scope")).toBe("read:user user:email");
    expect(url.searchParams.get("state")).toMatch(/^[a-f0-9]{64}$/);
    expect(url.searchParams.get("state")).not.toBe(state);
    const [key, value, ttl] = redis.set.mock.calls[1];
    const context = JSON.parse(value);
    expect(key).toBe(`auth:github:state:${context.state}`);
    expect(ttl).toBe(300);
    expect(context.browserHash).toBe(
      createHash("sha256").update(start.browserSecret).digest("hex"),
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(
      createHash("sha256").update(context.verifier).digest("base64url"),
    );
    expect(start.url).not.toContain("client-secret");
  });

  it("однократно использует state, обменивает код, получает профиль и email и возвращает связанного пользователя", async () => {
    githubReplies();
    await expect(service.callback("code", state, browser)).resolves.toEqual(
      user,
    );
    expect(redis.getdel).toHaveBeenCalledWith(`auth:github:state:${state}`);
    expect(http).toHaveBeenNthCalledWith(
      1,
      "https://github.com/login/oauth/access_token",
      expect.objectContaining({ method: "POST" }),
    );
    const body = http.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("code")).toBe("code");
    expect(body.get("client_secret")).toBe("client-secret");
    expect(body.get("code_verifier")).toMatch(/^[a-f0-9]{64}$/);
    expect(http).toHaveBeenNthCalledWith(
      2,
      "https://api.github.com/user",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer github-secret",
        }),
      }),
    );
    expect(http).toHaveBeenNthCalledWith(
      3,
      "https://api.github.com/user/emails",
      expect.anything(),
    );
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { githubId: "123" },
      include: { role: true },
    });
    expect(users.create).not.toHaveBeenCalled();
    await expect(
      service.callback("code", state, browser),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(http).toHaveBeenCalledTimes(3);
  });

  it.each([
    undefined,
    "",
    "invalid",
    ["state"],
  ])("отклоняет некорректный state %p до HTTP-запроса", async (invalid) => {
    await expect(
      service.callback("code", invalid, browser),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(http).not.toHaveBeenCalled();
  });
  it("отклоняет истёкший или отсутствующий state", async () => {
    storage.clear();
    await expect(
      service.callback("code", state, browser),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(http).not.toHaveBeenCalled();
  });
  it("отклоняет несовпадение сохранённого state", async () => {
    const key = `auth:github:state:${state}`;
    const context = JSON.parse(storage.get(key) as string);
    storage.set(key, JSON.stringify({ ...context, state: "a".repeat(64) }));
    await expect(
      service.callback("code", state, browser),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it.each([
    undefined,
    "b".repeat(64),
  ])("отклоняет отсутствующую или несовпадающую привязку к браузеру", async (binding) => {
    await expect(
      service.callback("code", state, binding),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(http).not.toHaveBeenCalled();
  });
  it("отклоняет повреждённый контекст в Redis", async () => {
    storage.set(`auth:github:state:${state}`, "{");
    await expect(
      service.callback("code", state, browser),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it("удаляет state при отказе в авторизации или отсутствии кода", async () => {
    await expect(
      service.callback(undefined, state, browser),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(storage.size).toBe(0);
  });
  it("связывает пользователя по существующему email, сохраняя его пароль", async () => {
    githubReplies();
    prisma.user.findUnique.mockResolvedValue(null);
    users.findUserWithRoleByEmail.mockResolvedValue({
      ...user,
      githubId: null,
      passwordHash: "hash",
    });
    await expect(service.callback("code", state, browser)).resolves.toEqual(
      user,
    );
    expect(users.findUserWithRoleByEmail).toHaveBeenCalledWith(
      "user@example.com",
    );
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: user.id, githubId: null },
      data: { githubId: "123" },
    });
    expect(users.create).not.toHaveBeenCalled();
  });
  it("создаёт пользователя без пароля и возвращает его при повторном входе без дубликата", async () => {
    githubReplies();
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.callback("code", state, browser)).resolves.toEqual(
      user,
    );
    expect(users.create).toHaveBeenCalledWith({
      githubId: "123",
      email: user.email,
      passwordHash: null,
    });
    const next = await service.authorize();
    githubReplies();
    await service.callback(
      "next-code",
      new URL(next.url).searchParams.get("state"),
      next.browserSecret,
    );
    expect(users.create).toHaveBeenCalledTimes(1);
  });
  it("повторяет поиск при конкурентном нарушении ограничения уникальности", async () => {
    githubReplies();
    prisma.user.findUnique.mockResolvedValueOnce(null);
    users.create.mockRejectedValueOnce({ code: "P2002" });
    await expect(service.callback("code", state, browser)).resolves.toEqual(
      user,
    );
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
  });
  it("повторяет поиск при конкурентном связывании, сохраняя существующую связь", async () => {
    githubReplies();
    prisma.user.findUnique.mockResolvedValueOnce(null);
    users.findUserWithRoleByEmail.mockResolvedValue({
      ...user,
      githubId: null,
    });
    prisma.user.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.callback("code", state, browser)).resolves.toEqual(
      user,
    );
  });
  it("отклоняет email, уже связанный с другим аккаунтом GitHub", async () => {
    githubReplies();
    prisma.user.findUnique.mockResolvedValue(null);
    users.findUserWithRoleByEmail.mockResolvedValue({
      ...user,
      githubId: "456",
    });
    await expect(
      service.callback("code", state, browser),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
  it("отклоняет вход при отсутствии подтверждённого email", async () => {
    githubReplies([{ email: user.email, verified: false, primary: true }]);
    await expect(
      service.callback("code", state, browser),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
  it("выбирает подтверждённый основной email, а при его отсутствии — другой подтверждённый", async () => {
    githubReplies([
      { email: "unverified@example.com", verified: false, primary: true },
      { email: user.email, verified: true, primary: false },
    ]);
    prisma.user.findUnique.mockResolvedValue(null);
    await service.callback("code", state, browser);
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: user.email }),
    );
  });
  it.each([
    0, 1, 2,
  ])("обрабатывает HTTP-ошибку запроса с индексом %i", async (index) => {
    const values = [
      { access_token: "secret", token_type: "bearer" },
      { id: 123 },
      [],
    ];
    for (let i = 0; i < index; i++)
      http.mockResolvedValueOnce(reply(values[i]));
    http.mockResolvedValueOnce(reply({}, false));
    await expect(
      service.callback("code", state, browser),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(users.create).not.toHaveBeenCalled();
  });
  it.each([
    [{ error: "bad_verification_code" }],
    [{ access_token: "secret", token_type: "bearer" }, { id: "123" }],
    [
      { access_token: "secret", token_type: "bearer" },
      { id: 123 },
      { email: user.email },
    ],
  ])("отклоняет некорректные ответы GitHub", async (...values) => {
    for (const value of values) http.mockResolvedValueOnce(reply(value));
    await expect(
      service.callback("code", state, browser),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
  it("скрывает чувствительные данные в сетевых ошибках", async () => {
    http.mockRejectedValueOnce(new Error("client-secret"));
    await expect(service.callback("code", state, browser)).rejects.toThrow(
      "GitHub authentication failed",
    );
  });
  it("отклоняет авторизацию при недоступности Redis", async () => {
    redis.getdel.mockRejectedValueOnce(new Error("redis"));
    await expect(
      service.callback("code", state, browser),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(http).not.toHaveBeenCalled();
    redis.set.mockRejectedValueOnce(new Error("redis"));
    await expect(service.authorize()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

describe("GitHub OAuth availability", () => {
  const settings: Record<string, string> = {
    GITHUB_CLIENT_ID: "client-id",
    GITHUB_CLIENT_SECRET: "client-secret",
    GITHUB_CALLBACK_URL: "https://api.example.com/api/v1/auth/github/callback",
    FRONTEND_URL: "https://web.example.com",
  };

  it.each([
    null,
    ...Object.keys(settings),
  ])("reports availability consistently with authorize when %s is missing", async (missing) => {
    const redis = { set: jest.fn() };
    const service = new GithubOAuthService(
      {
        get: (key: string) => (key === missing ? undefined : settings[key]),
      } as ConfigService,
      redis as unknown as RedisService,
      {} as PrismaService,
      {} as UsersService,
    );
    expect(service.isAvailable()).toBe(missing === null);
    expect(redis.set).not.toHaveBeenCalled();
    if (missing) {
      await expect(service.authorize()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    } else {
      await expect(service.authorize()).resolves.toHaveProperty("url");
    }
  });
});
