#!/bin/sh
set -e

echo "Applying database migrations..."

if [ -f "./node_modules/.bin/prisma" ]; then
  ./node_modules/.bin/prisma migrate deploy --schema=./apps/api/prisma/schema.prisma --config=./apps/api/prisma.config.ts
elif [ -f "./apps/api/node_modules/.bin/prisma" ]; then
  ./apps/api/node_modules/.bin/prisma migrate deploy --schema=./apps/api/prisma/schema.prisma --config=./apps/api/prisma.config.ts
else
  npx prisma migrate deploy --schema=./apps/api/prisma/schema.prisma --config=./apps/api/prisma.config.ts
fi

echo "Starting application..."
exec node apps/api/dist/src/main.js
