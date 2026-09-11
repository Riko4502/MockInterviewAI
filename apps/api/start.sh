#!/bin/sh
set -e

echo "Applying database migrations..."
npx prisma migrate deploy --schema=./apps/api/prisma/schema.prisma

echo "Starting application..."
exec node apps/api/dist/src/main.js
