import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { TokenPayload } from "../../modules/auth/services/token.service";

/**
 * Декоратор для извлечения данных текущего авторизованного пользователя из запроса.
 *
 * @example
 * ```typescript
 * @Get('me')
 * getMe(@CurrentUser() user: TokenPayload) { ... }
 *
 * @Patch('me')
 * updateMe(@CurrentUser('sub') userId: string) { ... }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: keyof TokenPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as TokenPayload | undefined;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
