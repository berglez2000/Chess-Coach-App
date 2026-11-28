# Deploying Chess Coach to a home VM

Target: one Ubuntu Server 24.04 VM on Proxmox (4 vCPU, 6 GB RAM, 30 GB disk), reached only over SSH. No Docker on the server; every piece is installed directly so you can see how it fits together.

```
 Browser ──WireGuard VPN──> VM-IP:3000  Next.js (systemd: chess-coach)
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
| WireGuard (on router, run by the Proxmox owner) | private access from your devices, no public ports | router |
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

It installs packages, creates the `chess` system user, creates the database with a random password, writes `/etc/chess-coach/env`, installs the service, the sudo rule, the firewall and the backup cron job. Re-running is safe. At the end it prints a deploy key and next steps.

Why a separate user: if the app is ever compromised, the attacker owns `/opt/chess-coach`, not the VM. Root never runs application code.

## 2. Give the server read access to GitHub

The script printed an `ssh-ed25519 ...` public key. In GitHub: repository → Settings → Deploy keys → Add, paste it, leave "Allow write access" unchecked. A deploy key is a key tied to one repository, read-only. The VM can `git pull` but can never push or see your other repositories.

## 3. Fill in secrets

```bash
sudo nano /etc/chess-coach/env
```

Set the API keys you have; they are shared by every user who has not added their own. Each signed-in user can also add personal keys in the app under **Settings → API keys**, which needs no SSH or restart; those are stored in PostgreSQL, encrypted with `API_KEY_ENCRYPTION_SECRET` from this file. Leave `BETTER_AUTH_URL` for step 6. Everything else is already filled. The file is mode `640 root:chess`: root edits it, the app reads it, nobody else sees it.

## 4. VPN

Ask the router owner to add your Mac and phone to the WireGuard VPN. Until then everything below runs over SSH only.

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

## 6. Access over WireGuard (current plan)

The VM sits behind a WireGuard VPN run on the home router; no port other than SSH is forwarded. The app binds `127.0.0.1` by default, so once the VPN exists it must listen on the VM's LAN/VPN address as well:

```bash
# override the bind address without touching package.json
sudo systemctl edit chess-coach      # add under [Service]:
#   ExecStart=
#   ExecStart=/usr/bin/npx next start --hostname 0.0.0.0
sudo ufw allow in on wg0 to any port 3000 proto tcp   # or from the LAN subnet: sudo ufw allow from 192.168.55.0/24 to any port 3000
sudo sed -i -e 's#^BETTER_AUTH_URL=.*#BETTER_AUTH_URL=http://192.168.55.60:3000#' -e 's#^BETTER_AUTH_ALLOW_HTTP=.*#BETTER_AUTH_ALLOW_HTTP=true#' /etc/chess-coach/env
sudo systemctl restart chess-coach
```

`BETTER_AUTH_URL` must be exactly what the browser shows (plain `http` is fine inside the VPN). Replace the interface name and address with what the router owner gives you.

## 6b. Alternative: Tailscale Funnel (not installed by default)

Run the setup script with `INSTALL_TAILSCALE=1` to install it.

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

An env file written before personal API keys existed has no `API_KEY_ENCRYPTION_SECRET`, and Settings then says personal keys are turned off. Add the secret once and restart:

```bash
sudo grep -q '^API_KEY_ENCRYPTION_SECRET=' /etc/chess-coach/env || echo "API_KEY_ENCRYPTION_SECRET=$(openssl rand -hex 32)" | sudo tee -a /etc/chess-coach/env >/dev/null
sudo systemctl restart chess-coach
```

## 8. Backups and recovery

Nightly at 03:30 `backup.sh` writes `/opt/chess-coach/backups/db-DATE.sql.gz` (and opening videos), keeps 14 days. Run it manually with `sudo -iu chess chess-coach-backup`. Copy backups off the VM occasionally, for example `scp` to your Mac or let the Proxmox owner include the VM in their backup job. The dump holds users' personal API keys only in encrypted form; keep a copy of `API_KEY_ENCRYPTION_SECRET` from `/etc/chess-coach/env` somewhere else, or restored keys cannot be read and users must enter them again.

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
| VPN peers (if WireGuard runs on the VM) | `sudo wg show` |

## Gotchas met on the first deploy

- `npm ci` must run with `--include=dev`: the deploy script exports `NODE_ENV=production` first, and npm then silently skips devDependencies (Tailwind, Prisma CLI, TypeScript), so `next build` fails with `Cannot find module '@tailwindcss/postcss'`.
- After a failed build, Turbopack can keep a stale cache in `.next` that repeats the old error even once the module is installed. `rm -rf /opt/chess-coach/app/.next` and build again.
- If SSH listens on a non-default port, `ufw allow OpenSSH` only opens 22. The setup script now reads the real port from `sshd -T`. A router forward (for example external 2222 to internal 22) is fine as is.
- A placeholder API key (`your-...`) in the env file makes the provider look configured. Leave unused keys empty.
- Over plain HTTP inside the VPN, a personal API key travels unencrypted on that link once, when it is saved in Settings.

## Known limits

- Stockfish from Ubuntu apt is version 16; development used 19. Fine for coaching. For the newest binary, download from stockfishchess.org and point `STOCKFISH_PATH` at it.
- PostgreSQL from Ubuntu apt is version 16; development used 18. Prisma migrations run on both.
- Maia opponent is off (`MAIA_PATH` empty) until an x86_64 Linux binary is placed on the VM.
- Rate limiting counts requests by client IP. Inside the VPN all requests come from a few addresses; treat limits as best effort.
