import { createHash, randomBytes } from "node:crypto";
import {
  BadGatewayException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { PrismaService } from "../../../prisma/prisma.service";
import { RedisService } from "../../../redis/redis.service";
import { UsersService } from "../../users/users.service";

const STATE_PREFIX = "auth:github:state:";
export const GITHUB_STATE_TTL_SECONDS = 300;
export const GITHUB_STATE_COOKIE = "github_oauth_state";
const secretSchema = z.string().regex(/^[a-f0-9]{64}$/);
const contextSchema = z.object({
  state: secretSchema,
  browserHash: secretSchema,
  verifier: secretSchema,
});
const tokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().refine((value) => value.toLowerCase() === "bearer"),
  error: z.never().optional(),
});
const profileSchema = z.object({ id: z.number().int().positive().safe() });
const emailsSchema = z.array(
  z.object({
    email: z.email(),
    verified: z.boolean(),
    primary: z.boolean(),
  }),
);

@Injectable()
export class GithubOAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  private settings() {
    const clientId = this.config.get<string>("GITHUB_CLIENT_ID");
    const clientSecret = this.config.get<string>("GITHUB_CLIENT_SECRET");
    const callbackUrl = this.config.get<string>("GITHUB_CALLBACK_URL");
    const frontendUrl = this.config.get<string>("FRONTEND_URL");
    if (!clientId || !clientSecret || !callbackUrl || !frontendUrl) {
      throw new ServiceUnavailableException("GitHub OAuth is not configured");
    }
    return { clientId, clientSecret, callbackUrl, frontendUrl };
  }

  async authorize() {
    const { clientId, callbackUrl } = this.settings();
    const state = randomBytes(32).toString("hex");
    const browserSecret = randomBytes(32).toString("hex");
    const verifier = randomBytes(32).toString("hex");
    try {
      await this.redis.set(
        STATE_PREFIX + state,
        JSON.stringify({
          state,
          browserHash: this.hash(browserSecret),
          verifier,
        }),
        GITHUB_STATE_TTL_SECONDS,
      );
    } catch {
      throw new ServiceUnavailableException("GitHub login is unavailable");
    }
    const url = new URL("https://github.com/login/oauth/authorize");
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: "read:user user:email",
      state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    }).toString();
    return { url: url.toString(), browserSecret };
  }

  async callback(code: unknown, state: unknown, browserSecret: unknown) {
    if (
      !secretSchema.safeParse(state).success ||
      !secretSchema.safeParse(browserSecret).success
    ) {
      throw new UnauthorizedException("Invalid OAuth state");
    }
    let stored: string | null;
    try {
      stored = await this.redis.getdel(STATE_PREFIX + state);
    } catch {
      throw new ServiceUnavailableException("GitHub login is unavailable");
    }
    let context: z.infer<typeof contextSchema>;
    try {
      context = contextSchema.parse(JSON.parse(stored ?? "null"));
    } catch {
      throw new UnauthorizedException("Invalid OAuth state");
    }
    if (
      context.state !== state ||
      context.browserHash !== this.hash(browserSecret as string)
    ) {
      throw new UnauthorizedException("Invalid OAuth state");
    }
    if (typeof code !== "string" || !code || code.length > 1024) {
      throw new UnauthorizedException("Invalid OAuth code");
    }
    const { clientId, clientSecret, callbackUrl } = this.settings();
    const token = await this.request(
      "https://github.com/login/oauth/access_token",
      tokenSchema,
      {
        method: "POST",
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: callbackUrl,
          code,
          code_verifier: context.verifier,
        }),
      },
    );
    const headers = { Authorization: `Bearer ${token.access_token}` };
    const profile = await this.request(
      "https://api.github.com/user",
      profileSchema,
      { headers },
    );
    const emails = await this.request(
      "https://api.github.com/user/emails",
      emailsSchema,
      { headers },
    );
    const email =
      emails.find((item) => item.primary && item.verified) ??
      emails.find((item) => item.verified);
    if (!email) {
      throw new UnauthorizedException("GitHub account has no verified email");
    }
    return this.findOrCreateUser(
      String(profile.id),
      email.email.trim().toLowerCase(),
    );
  }

  private async request<T>(
    url: string,
    schema: z.ZodType<T>,
    init: RequestInit,
  ): Promise<T> {
    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          Accept: "application/json",
          "User-Agent": "MockInterviewAI",
          ...init.headers,
        },
        signal: AbortSignal.timeout(10_000),
        redirect: "error",
      });
      if (!response.ok) throw new Error("GitHub HTTP error");
      return schema.parse(await response.json());
    } catch {
      // Never expose provider responses, credentials or tokens in errors/logs.
      throw new BadGatewayException("GitHub authentication failed");
    }
  }

  private hash(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }

  private async findOrCreateUser(githubId: string, email: string) {
    // Retry after a concurrent create/link; unique constraints arbitrate identity.
    for (let attempt = 0; attempt < 3; attempt++) {
      const linked = await this.prisma.user.findUnique({
        where: { githubId },
        include: { role: true },
      });
      if (linked) return linked;
      const existing = await this.users.findUserWithRoleByEmail(email);
      if (existing?.githubId && existing.githubId !== githubId) {
        throw new ConflictException("Account is already linked to GitHub");
      }
      try {
        if (existing) {
          const result = await this.prisma.user.updateMany({
            where: { id: existing.id, githubId: null },
            data: { githubId },
          });
          if (!result.count) continue;
          const user = await this.users.findUserWithRoleById(existing.id);
          if (user) return user;
        } else {
          const created = await this.users.create({
            email,
            githubId,
            passwordHash: null,
          });
          const user = await this.users.findUserWithRoleById(created.id);
          if (user) return user;
        }
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2002"
        )
          continue;
        throw error;
      }
    }
    throw new ConflictException("GitHub account changed; please retry login");
  }
}
