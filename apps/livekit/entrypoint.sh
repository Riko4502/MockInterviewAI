#!/bin/sh
set -e

# Если заданы LIVEKIT_API_KEY и LIVEKIT_API_SECRET, формируем LIVEKIT_KEYS
if [ -n "$LIVEKIT_API_KEY" ] && [ -n "$LIVEKIT_API_SECRET" ]; then
  export LIVEKIT_KEYS="${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}"
fi

exec /livekit-server
