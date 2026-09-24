FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat && \
    corepack enable && \
    corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .pnpmfile.cjs* tsconfig*.json ./
COPY types ./types
COPY apps/telegram-bot/package.json ./apps/telegram-bot/
COPY packages ./packages

RUN pnpm install --frozen-lockfile

# Runner stage (бот запускается через tsx, без собранного dist)
FROM base AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 bot

COPY --from=deps --chown=bot:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=bot:nodejs /app/apps/telegram-bot/node_modules ./apps/telegram-bot/node_modules
COPY --from=deps --chown=bot:nodejs /app/packages ./packages

COPY --chown=bot:nodejs package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .pnpmfile.cjs* tsconfig*.json ./
COPY --chown=bot:nodejs types ./types
COPY --chown=bot:nodejs apps/telegram-bot ./apps/telegram-bot

USER 1001:1001

WORKDIR /app/apps/telegram-bot

# Порт прослушивания webhook-сервера приходит через TELEGRAM_WEBHOOK_PORT
# (в проде — $PORT платформы, см. config.ts).
EXPOSE 8443

CMD ["pnpm", "exec", "tsx", "src/index.ts"]