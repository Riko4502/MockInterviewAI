FROM node:20-alpine AS builder

# Устанавливаем рабочую директорию
WORKDIR /app

# Кешируем зависимости
COPY package.json pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY . .

# Устанавливаем pnpm и зависимости
RUN npm i -g pnpm@9 && \
    pnpm install --frozen-lockfile

# Сборка только Landing‑приложения
RUN pnpm --filter landing build

# -------------------------------------------------------------
# Runtime stage – отдаём статический контент через nginx
# -------------------------------------------------------------
FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Копируем собранный сайт
COPY --from=builder /app/apps/landing/dist /usr/share/nginx/html

# Открываем порт 80
EXPOSE 80

# Запуск nginx в форграунде
CMD ["nginx", "-g", "daemon off;" ]
