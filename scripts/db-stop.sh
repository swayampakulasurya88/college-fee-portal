#!/usr/bin/env bash
# Stops the project-local MongoDB instance.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MONGO="$ROOT/.mongodb"

if [ -x "$MONGO/server/bin/mongod" ]; then
  "$MONGO/server/bin/mongod" --dbpath "$MONGO/data" --shutdown 2>/dev/null || true
fi

pkill -f "$MONGO/server/bin/mongod" 2>/dev/null || true
echo "MongoDB stopped."
