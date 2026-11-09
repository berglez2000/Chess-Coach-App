#!/usr/bin/env bash
# One-time server preparation. Run ONCE as root on a fresh Ubuntu 24.04 VM:
#   sudo bash 01-server-setup.sh
#
# What it does, in order:
#   1. Installs system packages: PostgreSQL, Stockfish, git, ufw, Node.js 24.
#   2. Creates an unprivileged system user "chess" that will own and run the app.
#   3. Creates the PostgreSQL role and database with a random password.
#   4. Writes /etc/chess-coach/env with generated secrets (readable only by root and chess).
#   5. Installs the systemd service and enables the firewall (SSH + Tailscale only).
# Safe to re-run: every step checks whether it has already been done.
set -euo pipefail

APP_USER="chess"
APP_HOME="/opt/chess-coach"
APP_DIR="$APP_HOME/app"
ENV_DIR="/etc/chess-coach"
ENV_FILE="$ENV_DIR/env"
DB_NAME="chess_coach"
DB_USER="chess_coach"
REPO_URL="${REPO_URL:-git@github.com:berglez2000/Chess-Coach-App.git}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $EUID -ne 0 ]]; then echo "Run as root: sudo bash $0" >&2; exit 1; fi

echo "== 1/5 System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg git ufw postgresql postgresql-contrib stockfish rsync

if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(".")[0]')" != "24" ]]; then
  # NodeSource provides a system-wide Node 24; nvm is per-user and awkward under systemd.
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
echo "node $(node --version), npm $(npm --version), stockfish at $(command -v stockfish)"

echo "== 2/5 Application user"
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  # System user: no password, no login shell by default, home at /opt/chess-coach.
  useradd --system --create-home --home-dir "$APP_HOME" --shell /bin/bash "$APP_USER"
fi
install -d -o "$APP_USER" -g "$APP_USER" -m 750 "$APP_HOME" "$APP_HOME/backups"
# SSH key the app user will use as a read-only GitHub deploy key.
if [[ ! -f "$APP_HOME/.ssh/id_ed25519" ]]; then
  install -d -o "$APP_USER" -g "$APP_USER" -m 700 "$APP_HOME/.ssh"
  sudo -u "$APP_USER" ssh-keygen -t ed25519 -N "" -C "chess-coach-deploy" -f "$APP_HOME/.ssh/id_ed25519" >/dev/null
  sudo -u "$APP_USER" bash -c "ssh-keyscan github.com >> $APP_HOME/.ssh/known_hosts 2>/dev/null"
fi

echo "== 3/5 PostgreSQL role and database"
systemctl enable --now postgresql
DB_PASSWORD=""
if [[ -f "$ENV_FILE" ]] && grep -q '^DATABASE_URL=' "$ENV_FILE"; then
  DB_PASSWORD="$(sed -nE 's#^DATABASE_URL=postgresql://[^:]+:([^@]+)@.*#\1#p' "$ENV_FILE")"
fi
if [[ -z "$DB_PASSWORD" ]]; then DB_PASSWORD="$(openssl rand -hex 24)"; fi
sudo -u postgres psql -v ON_ERROR_STOP=1 -v user="$DB_USER" -v pass="$DB_PASSWORD" -v db="$DB_NAME" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'user', :'pass') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'user') \gexec
SELECT format('ALTER ROLE %I PASSWORD %L', :'user', :'pass') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'db', :'user') WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db') \gexec
SQL

echo "== 4/5 Environment file"
install -d -m 750 -o root -g "$APP_USER" "$ENV_DIR"
if [[ ! -f "$ENV_FILE" ]]; then
  sed -e "s#__DB_PASSWORD__#$DB_PASSWORD#" \
      -e "s#__AUTH_SECRET__#$(openssl rand -hex 32)#" \
      "$SCRIPT_DIR/env.production.example" > "$ENV_FILE"
  chown root:"$APP_USER" "$ENV_FILE"; chmod 640 "$ENV_FILE"
  echo "Wrote $ENV_FILE. Edit it to add API keys and the public BETTER_AUTH_URL."
else
  echo "$ENV_FILE exists, left untouched."
fi

echo "== 5/5 systemd service, sudo rule, Tailscale, firewall"
install -m 644 "$SCRIPT_DIR/chess-coach.service" /etc/systemd/system/chess-coach.service
systemctl daemon-reload
systemctl enable chess-coach >/dev/null
# Let the chess user restart/inspect only its own service, nothing else, without a password.
cat > /etc/sudoers.d/chess-coach <<SUDO
$APP_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart chess-coach, /usr/bin/systemctl stop chess-coach, /usr/bin/systemctl start chess-coach, /usr/bin/systemctl status chess-coach
SUDO
chmod 440 /etc/sudoers.d/chess-coach
visudo -cf /etc/sudoers.d/chess-coach >/dev/null
# Tailscale gives a stable HTTPS URL (Funnel) without opening router ports or owning a domain.
if ! command -v tailscale >/dev/null; then curl -fsSL https://tailscale.com/install.sh | sh; fi
# Firewall: only SSH from the LAN and anything arriving over Tailscale. App port 3000 stays loopback-only.
ufw allow OpenSSH >/dev/null
ufw allow in on tailscale0 >/dev/null 2>&1 || true
ufw --force enable >/dev/null
# Nightly database backup at 03:30, kept 14 days.
install -m 755 "$SCRIPT_DIR/backup.sh" /usr/local/bin/chess-coach-backup
echo "30 3 * * * $APP_USER /usr/local/bin/chess-coach-backup" > /etc/cron.d/chess-coach-backup

cat <<MSG

Server prepared. Next steps:
 1. Add this read-only deploy key to GitHub (repo -> Settings -> Deploy keys):
      $(cat "$APP_HOME/.ssh/id_ed25519.pub")
 2. Edit secrets:   sudo nano $ENV_FILE
 3. Join Tailscale:  sudo tailscale up   (open the printed URL, log in once)
 4. First deploy:   sudo -iu $APP_USER git clone $REPO_URL $APP_DIR && sudo -iu $APP_USER $APP_DIR/deploy/02-deploy.sh
 5. Expose it:      sudo tailscale funnel --bg 3000   (then put the printed https URL into BETTER_AUTH_URL and restart)
 6. Logs:           journalctl -u chess-coach -f
MSG
