FROM node:22-alpine AS base

# Builder stage
FROM base AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat && \
    corepack enable && \
    corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .pnpmfile.cjs* tsconfig.json ./
COPY types ./types
COPY apps/landing/package.json ./apps/landing/
COPY packages ./packages

RUN pnpm install --frozen-lockfile

COPY apps/landing ./apps/landing

RUN pnpm --filter=!@packages/api --filter='./packages/*' build && \
    pnpm --filter landing build

# -------------------------------------------------------------
# Runtime stage – отдаём статический контент через nginx
# -------------------------------------------------------------
FROM nginx:alpine AS runtime

COPY apps/landing/nginx.conf /etc/nginx/conf.d/default.conf
# Копируем собранный сайт
COPY --from=builder /app/apps/landing/dist /usr/share/nginx/html

# Открываем порт 80
EXPOSE 80

# Запуск nginx в фоновом режиме контейнера
CMD ["nginx", "-g", "daemon off;"]
