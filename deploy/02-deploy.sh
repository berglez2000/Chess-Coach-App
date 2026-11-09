#!/usr/bin/env bash
# Deploy or update the app. Run as the "chess" user (sudo -iu chess), from anywhere:
#   /opt/chess-coach/app/deploy/02-deploy.sh            # pull latest main and deploy
#   /opt/chess-coach/app/deploy/02-deploy.sh --no-pull  # redeploy current checkout
#
# Steps: git pull -> npm ci -> next build -> prisma migrate deploy -> restart service.
# Build happens before restart, so a failed build leaves the running version untouched.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/chess-coach/app}"
ENV_FILE="${ENV_FILE:-/etc/chess-coach/env}"
BRANCH="${BRANCH:-main}"
PULL=1; [[ "${1:-}" == "--no-pull" ]] && PULL=0

cd "$APP_DIR"
# Export every variable from the env file so prisma and npm scripts see DATABASE_URL etc.
set -a; source "$ENV_FILE"; set +a
export NODE_ENV=production

if [[ $PULL -eq 1 ]]; then
  echo "== Pulling $BRANCH"
  git fetch --quiet origin "$BRANCH"
  git checkout --quiet "$BRANCH"
  git reset --hard --quiet "origin/$BRANCH"
fi
echo "== At commit $(git rev-parse --short HEAD): $(git log -1 --pretty=%s)"

echo "== Installing dependencies (includes devDependencies, needed for prisma generate and build)"
npm ci --no-audit --no-fund

echo "== Building"
# Builds into .next while the old server keeps running; a failed build aborts before restart.
npm run build

echo "== Applying database migrations"
npx prisma migrate deploy

echo "== Restarting service"
# The chess user may restart only this one unit (see sudoers rule installed by 01-server-setup.sh).
sudo systemctl restart chess-coach
sleep 2
if systemctl is-active --quiet chess-coach; then
  echo "chess-coach is running. Logs: journalctl -u chess-coach -f"
  curl -fsS -o /dev/null -w "HTTP %{http_code} from http://127.0.0.1:3000\n" http://127.0.0.1:3000/ || echo "App not answering yet, check logs."
else
  echo "Service failed to start:" >&2
  journalctl -u chess-coach -n 40 --no-pager >&2
  exit 1
fi
