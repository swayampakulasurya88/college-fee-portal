#!/usr/bin/env bash
# Starts the project-local MongoDB instance (no root / no system install needed).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MONGO="$ROOT/.mongodb"

if [ ! -x "$MONGO/server/bin/mongod" ]; then
  echo "MongoDB binary not found at $MONGO/server/bin/mongod"
  echo "Download it with:"
  echo "  mkdir -p .mongodb && cd .mongodb"
  echo "  curl -L -o mongo.tgz https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2404-8.0.4.tgz"
  echo "  tar -xzf mongo.tgz && mv mongodb-linux-x86_64-ubuntu2404-8.0.4 server && rm mongo.tgz"
  exit 1
fi

mkdir -p "$MONGO/data" "$MONGO/logs"

if pgrep -f "$MONGO/server/bin/mongod" >/dev/null 2>&1; then
  echo "MongoDB is already running."
  exit 0
fi

"$MONGO/server/bin/mongod" \
  --dbpath "$MONGO/data" \
  --bind_ip 127.0.0.1 \
  --port 27017 \
  --fork \
  --logpath "$MONGO/logs/mongod.log"

echo "MongoDB started -> mongodb://127.0.0.1:27017"
