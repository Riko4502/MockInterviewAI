#!/bin/bash

# ==============================================================================
# Vercel Ignored Build Step: Storybook / UI-Docs
#
# Exit code 1: VERCEL PROCEEDS with the build (Changes detected)
# Exit code 0: VERCEL CANCELS / SKIPS the build (No changes detected)
# ==============================================================================

echo "🔍 [Vercel Ignore Check] Checking changes for UI / Storybook..."

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

# 3. Проверяем изменения в apps/ui-docs, packages/ui, packages/icons, packages/tailwind-config, packages/utils и корневых манифестах
git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" "$VERCEL_GIT_COMMIT_SHA" -- \
  apps/ui-docs \
  packages/ui \
  packages/icons \
  packages/tailwind-config \
  packages/utils \
  package.json \
  pnpm-lock.yaml \
  pnpm-workspace.yaml \
  turbo.json

DIFF_RESULT=$?

if [ $DIFF_RESULT -eq 1 ]; then
  echo "✅ [Vercel Ignore Check] Changes detected in UI / Storybook / shared packages. Proceeding with build."
  exit 1
else
  echo "🛑 [Vercel Ignore Check] No changes in UI / UI-Docs. Build skipped."
  exit 0
fi
