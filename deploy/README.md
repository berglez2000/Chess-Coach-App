# Deploying Chess Coach to a home VM

Target: one Ubuntu Server 24.04 VM on Proxmox (4 vCPU, 6 GB RAM, 30 GB disk), reached only over SSH. No Docker on the server; every piece is installed directly so you can see how it fits together.

```
 Browser ──HTTPS──> Tailscale Funnel ──> 127.0.0.1:3000  Next.js (systemd: chess-coach)
                                                │
                                                ├── spawns /usr/games/stockfish
                                                └── 127.0.0.1:5432  PostgreSQL (systemd: postgresql)
```

| Piece | Role | Where |
|---|---|---|
| Node 24 + Next.js | the app itself | `/opt/chess-coach/app`, run by user `chess` |
| PostgreSQL | games, users, puzzles | system service, local socket only |
| Stockfish | engine, spawned per analysis | `/usr/games/stockfish` |
| systemd unit | keeps app alive, restarts on crash, boots with VM | `/etc/systemd/system/chess-coach.service` |
| env file | secrets and config | `/etc/chess-coach/env` |
| Tailscale Funnel | public HTTPS URL, no router ports, no domain needed | `tailscale funnel` |
| cron + `backup.sh` | nightly `pg_dump` | `/opt/chess-coach/backups` |

## 0. What you need from the Proxmox owner

- VM with Ubuntu Server 24.04, CPU type set to `host` (Stockfish wants AVX2), static LAN IP or DHCP reservation.
- A user with `sudo` and your SSH public key installed. Password SSH login ideally disabled.
- A snapshot taken before you begin.

Test: `ssh you@VM-IP`, then `nproc`, `free -h`, `uname -m` (must say `x86_64`).

## 1. Prepare the server (once, as root)

Copy this folder to the VM and run the setup script:

```bash
# on your Mac
scp -r deploy you@VM-IP:~/
# on the VM
sudo bash ~/deploy/01-server-setup.sh
```

It installs packages, creates the `chess` system user, creates the database with a random password, writes `/etc/chess-coach/env`, installs the service, the sudo rule, Tailscale, the firewall and the backup cron job. Re-running is safe. At the end it prints a deploy key and next steps.

Why a separate user: if the app is ever compromised, the attacker owns `/opt/chess-coach`, not the VM. Root never runs application code.

## 2. Give the server read access to GitHub

The script printed an `ssh-ed25519 ...` public key. In GitHub: repository → Settings → Deploy keys → Add, paste it, leave "Allow write access" unchecked. A deploy key is a key tied to one repository, read-only. The VM can `git pull` but can never push or see your other repositories.

## 3. Fill in secrets

```bash
sudo nano /etc/chess-coach/env
```

Set the API keys you have. Leave `BETTER_AUTH_URL` for step 6. Everything else is already filled. The file is mode `640 root:chess`: root edits it, the app reads it, nobody else sees it.

## 4. Join Tailscale

```bash
sudo tailscale up
```

Open the printed link, log in (free personal plan). Install Tailscale on your Mac and phone too; from then on `http://VM-NAME:3000` is not reachable (app binds loopback) but SSH over Tailscale works from anywhere, so the LAN IP stops mattering.

## 5. First deploy

```bash
sudo -iu chess git clone git@github.com:berglez2000/Chess-Coach-App.git /opt/chess-coach/app
sudo -iu chess /opt/chess-coach/app/deploy/02-deploy.sh --no-pull
```

The deploy script runs `npm ci`, `next build`, `prisma migrate deploy`, then restarts the service and curls it. First build takes a few minutes. Then:

```bash
systemctl status chess-coach
journalctl -u chess-coach -f        # live logs, Ctrl+C to leave
curl -I http://127.0.0.1:3000       # should answer 200 or 307
```

## 6. Expose it with Tailscale Funnel

Funnel publishes one port of your VM on a stable `https://VM-NAME.tailNNNN.ts.net` address, with a real certificate, through Tailscale's relays. Nothing on the home router changes and the VM's IP is never exposed.

```bash
sudo tailscale funnel --bg 3000
```

First time it prints a link to enable Funnel and HTTPS certificates in the admin console; click through once. It prints the public URL. Put it into the env file and restart:

```bash
sudo sed -i 's#^BETTER_AUTH_URL=.*#BETTER_AUTH_URL=https://VM-NAME.tailNNNN.ts.net#' /etc/chess-coach/env
sudo systemctl restart chess-coach
```

The URL must match exactly what the browser shows, or sign-in fails the origin check. Open it, register your account.

Private alternative: skip Funnel and run `sudo tailscale serve --bg 3000` instead. Same HTTPS URL, but only devices in your tailnet can open it. Good for "only me and my father".

## 7. Updating later

Push to `main` on GitHub, then on the VM:

```bash
sudo -iu chess /opt/chess-coach/app/deploy/02-deploy.sh
```

If the build fails, the old version keeps running. If the new version crashes on start, the script prints the last 40 log lines.

## 8. Backups and recovery

Nightly at 03:30 `backup.sh` writes `/opt/chess-coach/backups/db-DATE.sql.gz` (and opening videos), keeps 14 days. Run it manually with `sudo -iu chess chess-coach-backup`. Copy backups off the VM occasionally, for example `scp` to your Mac or let the Proxmox owner include the VM in their backup job.

Restore into an empty database:

```bash
sudo -iu chess bash -c 'set -a; source /etc/chess-coach/env; gunzip -c /opt/chess-coach/backups/db-DATE.sql.gz | psql "$DATABASE_URL"'
```

Password recovery and legacy game claiming work as in the main README, run as `chess` inside `/opt/chess-coach/app`:

```bash
sudo -iu chess bash -c 'cd /opt/chess-coach/app && set -a && source /etc/chess-coach/env && npm run auth:admin -- reset-password you@example.com'
```

## Cheat sheet

| Want | Command |
|---|---|
| Is it running | `systemctl status chess-coach` |
| Logs | `journalctl -u chess-coach -f` or `-n 200` |
| Restart | `sudo systemctl restart chess-coach` |
| Database shell | `sudo -u postgres psql chess_coach` |
| Disk / RAM / CPU | `df -h /`, `free -h`, `htop` |
| Who is connected via Tailscale | `tailscale status` |
| Public URL | `tailscale funnel status` |

## Known limits

- Stockfish from Ubuntu apt is version 16; development used 19. Fine for coaching. For the newest binary, download from stockfishchess.org and point `STOCKFISH_PATH` at it.
- PostgreSQL from Ubuntu apt is version 16; development used 18. Prisma migrations run on both.
- Maia opponent is off (`MAIA_PATH` empty) until an x86_64 Linux binary is placed on the VM.
- Rate limiting counts requests by client IP. Behind Funnel the app sees the forwarded IP header from Tailscale; treat limits as best effort.
