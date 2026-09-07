import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { MediaTokenResponseDto } from "@packages/dto";
import jwt from "jsonwebtoken";
import { RedisService } from "../../redis/redis.service";
import { sessionActiveKey, sessionMembersKey } from "../sessions/session-keys";

/** Алгоритм подписи LiveKit access token — HS256. */
const JWT_ALGORITHM = "HS256";

/** LiveKit video grant по умолчанию (subscribe-only). */
const SUBSCRIBE_ONLY_GRANT = {
  roomJoin: true,
  canPublish: false,
  canSubscribe: true,
  canPublishData: false,
  roomAdmin: false,
  roomRecord: false,
} as const;

/** Матрица grants по роли участника (§4.1 spec). */
const ROLE_GRANTS: Record<
  string,
  {
    canPublish: boolean;
    canPublishSources?: string[];
  }
> = {
  INTERVIEWER: {
    canPublish: true,
    canPublishSources: ["camera", "microphone", "screen_share"],
  },
  CANDIDATE: {
    canPublish: true,
    canPublishSources: ["camera", "microphone"],
  },
  OBSERVER: {
    canPublish: false,
  },
};

/**
 * Сервис генерации LiveKit access tokens для WebRTC медиа (§5.2 spec).
 *
 * Подписывает JWT (HS256) со стандартным LiveKit video grant.
 * Проверяет активность сессии и роль участника из Redis-зеркала (fail-closed).
 */
@Injectable()
export class LivekitService {
  private readonly logger = new Logger(LivekitService.name);

  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly serverUrl: string;
  private readonly tokenTtlSeconds: number;

  constructor(
    private readonly redis: RedisService,
    configService: ConfigService,
  ) {
    this.apiKey = configService.getOrThrow<string>("livekit.apiKey");
    this.apiSecret = configService.getOrThrow<string>("livekit.apiSecret");
    this.serverUrl = configService.getOrThrow<string>("livekit.url");
    this.tokenTtlSeconds =
      configService.get<number>("livekit.tokenTtlSeconds") ?? 1800;
  }

  /**
   * Генерирует LiveKit join-токен для участника интервью-сессии.
   *
   * Проверки (fail-closed):
   * 1. Сессия активна (`session:{id}:active === "true"`)
   * 2. Пользователь является участником (находится в `session:{id}:members`)
   * 3. Роль допустима (INTERVIEWER / CANDIDATE / OBSERVER)
   *
   * @param userId - UUID текущего пользователя.
   * @param sessionId - UUID интервью-сессии.
   * @returns `{ token, serverUrl, roomName }`.
   * @throws {ForbiddenException} Сессия не активна или пользователь не является участником.
   * @throws {UnauthorizedException} Неизвестное значение роли.
   */
  async generateMediaToken(
    userId: string,
    sessionId: string,
  ): Promise<MediaTokenResponseDto> {
    const activeKey = sessionActiveKey(sessionId);
    const membersKey = sessionMembersKey(sessionId);

    const [activeStatus, role] = await Promise.all([
      this.redis.get(activeKey),
      this.redis.hget(membersKey, userId),
    ]);

    if (activeStatus !== "true") {
      this.logger.warn(
        `media-token denied: session ${sessionId} is not active (status=${activeStatus})`,
      );
      throw new ForbiddenException("Session is not active");
    }

    if (role === null) {
      this.logger.warn(
        `media-token denied: user ${userId} is not a member of session ${sessionId}`,
      );
      throw new ForbiddenException("User is not a member of this session");
    }

    const roleUpper = role.toUpperCase();
    const roleConfig = ROLE_GRANTS[roleUpper];
    if (!roleConfig) {
      this.logger.warn(
        `media-token denied: unknown role "${role}" for user ${userId} in session ${sessionId}`,
      );
      throw new ForbiddenException("Unknown participant role");
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.apiKey,
      sub: userId,
      nbf: now,
      exp: now + this.tokenTtlSeconds,
      video: {
        room: sessionId,
        ...SUBSCRIBE_ONLY_GRANT,
        ...roleConfig,
      },
    };

    const token = jwt.sign(payload, this.apiSecret, {
      algorithm: JWT_ALGORITHM,
    });

    this.logger.debug(
      `media-token issued: user=${userId} session=${sessionId} role=${roleUpper}`,
    );

    return {
      token,
      serverUrl: this.serverUrl,
      roomName: sessionId,
    };
  }
}
