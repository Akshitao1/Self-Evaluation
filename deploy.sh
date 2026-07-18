#!/usr/bin/env bash

set -euo pipefail

BRANCH="release"
APP_NAME="${PM2_APP_NAME:-nextjs-app}"

echo "Starting deploy on branch: ${BRANCH}"

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required but not installed."
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "==> PM2 not found. Installing globally..."
  npm install -g pm2
  hash -r
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: this script must be run inside a git repository."
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: working tree is not clean. Commit/stash changes before deploying."
  exit 1
fi

echo "Clearing caches..."
npm run clean
npm cache clean --force

echo "==> Clearing PM2 logs/cache"
pm2 flush || true
pm2 cleardump || true

echo "Fetching latest code from git..."
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

echo "Installing dependencies..."
npm ci

echo "Building latest app..."
npm run build

echo "Restarting PM2 app: ${APP_NAME}"
if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
  pm2 restart "${APP_NAME}" --update-env
else
  pm2 start npm --name "${APP_NAME}" -- start
fi

pm2 save
echo "Deploy complete."
