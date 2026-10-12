#!/usr/bin/env bash
# One-time setup: downloads the portable MongoDB (if missing) and installs
# all Node dependencies for the API and the web client.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MONGO="$ROOT/.mongodb"
VERSION="8.0.4"
PKG="mongodb-linux-x86_64-ubuntu2404-$VERSION"

echo "==> Project: $ROOT"

if [ -x "$MONGO/server/bin/mongod" ]; then
  echo "==> MongoDB already present, skipping download."
else
  echo "==> Downloading MongoDB $VERSION (no root required)…"
  mkdir -p "$MONGO"
  cd "$MONGO"
  curl -sSL -o mongo.tgz "https://fastdl.mongodb.org/linux/$PKG.tgz"
  tar -xzf mongo.tgz
  mv "$PKG" server
  rm mongo.tgz
  mkdir -p data logs
  echo "==> MongoDB installed to $MONGO/server"
fi

echo "==> Installing root tools…"
cd "$ROOT" && npm install --no-audit --no-fund

echo "==> Installing API dependencies…"
npm --prefix server install --no-audit --no-fund

echo "==> Installing web dependencies…"
npm --prefix client install --no-audit --no-fund

echo ""
echo "✅ Setup complete. Next:"
echo "   npm run db:start   # start MongoDB"
echo "   npm run seed       # (optional) load demo students"
echo "   npm run dev        # start API + web app"
