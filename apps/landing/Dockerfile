FROM node:20-alpine AS builder

WORKDIR /app

# Устанавливаем pnpm
RUN npm i -g pnpm@9

# Копируем файлы конфигурации монорепозитория
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/landing/package.json ./apps/landing/
COPY packages ./packages

# Устанавливаем зависимости
RUN pnpm install --frozen-lockfile

# Копируем исходный код Landing
COPY apps/landing ./apps/landing

# Сборка только Landing‑приложения
RUN pnpm --filter landing build

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
