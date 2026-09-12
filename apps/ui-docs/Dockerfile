FROM node:22-alpine AS base

# Builder stage
FROM base AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat && \
    corepack enable && \
    corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .pnpmfile.cjs* tsconfig*.json ./
COPY types ./types
COPY apps/ui-docs/package.json ./apps/ui-docs/
COPY packages ./packages

RUN pnpm install --frozen-lockfile

COPY apps/ui-docs ./apps/ui-docs

RUN pnpm turbo run build --filter=ui-docs^... && \
    pnpm --filter ui-docs build

# -------------------------------------------------------------
# Runtime stage – отдаём статический контент через nginx
# -------------------------------------------------------------
FROM nginx:alpine AS runtime

COPY apps/ui-docs/nginx.conf /etc/nginx/conf.d/default.conf
# Копируем собранный Storybook
COPY --from=builder /app/apps/ui-docs/storybook-static /usr/share/nginx/html

# Открываем порт 80
EXPOSE 80

# Запуск nginx в фоновом режиме контейнера
CMD ["nginx", "-g", "daemon off;"]
