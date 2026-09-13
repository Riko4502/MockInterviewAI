#!/bin/bash

# ==============================================================================
# Vercel Ignored Build Step: Landing (Next.js)
#
# Exit code 1: VERCEL PROCEEDS with the build (Changes detected)
# Exit code 0: VERCEL CANCELS / SKIPS the build (No changes detected)
# ==============================================================================

echo "🔍 [Vercel Ignore Check] Checking changes for Landing (Next.js)..."

# 1. Если это первый коммит или переменные SHA отсутствуют, разрешаем сборку
if [ -z "$VERCEL_GIT_PREVIOUS_SHA" ] || [ -z "$VERCEL_GIT_COMMIT_SHA" ]; then
  echo "⚠️  [Vercel Ignore Check] Missing commit SHAs. Proceeding with build to be safe."
  exit 1
fi

# 2. Если предыдущий и текущий коммит совпадают, пропускаем
if [ "$VERCEL_GIT_PREVIOUS_SHA" = "$VERCEL_GIT_COMMIT_SHA" ]; then
  echo "🛑 [Vercel Ignore Check] Same commit SHA. Skipping build."
  exit 0
fi

# 3. Проверяем изменения в apps/landing, packages/i18n, packages/ui, packages/icons, packages/tailwind-config, packages/utils и корневых манифестах
git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" "$VERCEL_GIT_COMMIT_SHA" -- \
  apps/landing \
  packages/i18n \
  packages/ui \
  packages/icons \
  packages/tailwind-config \
  packages/utils \
  package.json \
  pnpm-lock.yaml \
  pnpm-workspace.yaml \
  turbo.json

DIFF_RESULT=$?

# Fail-safe: только код 0 гарантирует отсутствие изменений.
# Любой другой код (1 — изменения обнаружены, >=2 — ошибка git diff) приводит к exit 1 (сборка разрешена).
if [ $DIFF_RESULT -eq 0 ]; then
  echo "🛑 [Vercel Ignore Check] No changes in Landing. Build skipped."
  exit 0
elif [ $DIFF_RESULT -eq 1 ]; then
  echo "✅ [Vercel Ignore Check] Changes detected in Landing or shared packages. Proceeding with build."
  exit 1
else
  echo "⚠️  [Vercel Ignore Check] git diff returned code $DIFF_RESULT (error). Proceeding with build (fail-safe)."
  exit 1
fi
