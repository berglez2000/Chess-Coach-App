#!/usr/bin/env bash
# Nightly PostgreSQL dump + opening videos. Installed as /usr/local/bin/chess-coach-backup, runs via cron as "chess".
# Restore:  gunzip -c FILE.sql.gz | psql "$DATABASE_URL"
set -euo pipefail
ENV_FILE="${ENV_FILE:-/etc/chess-coach/env}"
BACKUP_DIR="${BACKUP_DIR:-/opt/chess-coach/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
set -a; source "$ENV_FILE"; set +a
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"
if [[ -d /opt/chess-coach/app/.storage ]]; then
  tar -czf "$BACKUP_DIR/storage-$STAMP.tar.gz" -C /opt/chess-coach/app .storage
fi
find "$BACKUP_DIR" -type f -mtime +"$KEEP_DAYS" -delete
echo "Backup written to $BACKUP_DIR/db-$STAMP.sql.gz"
