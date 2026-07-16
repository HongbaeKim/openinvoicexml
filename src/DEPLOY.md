# Deploying the backend (VPS)

Prerequisites: a VPS with Docker + Docker Compose installed, and DNS for
`api.openinvoicexml.de` already pointed at the VPS's IP (an A record — propagation must be
complete before requesting a cert, or the ACME challenge will fail).

## 1. First-time setup

```sh
git clone <repo> && cd <repo>/src
cp .env.example .env
# edit .env: set ALLOWED_ORIGIN=https://openinvoicexml.de, and change BOTH DATABASE_URL and
# POSTGRES_PASSWORD to the same real password (not the "app:app" dev default) — they're
# independent variables that must match, see docker-compose.yml's comments
```

**Important:** `POSTGRES_PASSWORD` only takes effect the first time Postgres initializes its
data directory. Set the real password in `.env` *before* the first `docker compose up` —
changing it afterwards on an already-running deployment does nothing silently (the volume
already has the old password baked in) until you either wipe the volume (destroys data) or
change it manually inside Postgres (`ALTER USER app WITH PASSWORD '...'`) and update
`DATABASE_URL` to match.

## 2. Bootstrap the first TLS cert

nginx's config hardcodes paths to cert files that don't exist yet — with them missing, nginx
refuses to start at all (it loads its config atomically), including the port-80 block that would
otherwise serve the ACME challenge. So the very first cert has to be obtained **before nginx
starts**, using Certbot's `--standalone` mode (it binds port 80 itself, briefly — fine, since
nothing else is listening on it yet):

```sh
docker compose --profile production run --rm -p 80:80 certbot certonly \
  --standalone -d api.openinvoicexml.de \
  --email you@openinvoicexml.de --agree-tos -n
```

## 3. Start the stack

```sh
docker compose --profile production up -d
```

nginx now starts successfully (the cert from step 2 exists) and owns port 80/443 going forward.
Verify: `curl https://api.openinvoicexml.de/health` → `{"status":"ok"}`.

## 4. Set up renewal

nginx owns port 80 continuously from now on, so all renewals after the first use `--webroot`
instead of `--standalone`. Docker Compose has no built-in scheduler, so this is a host cron job:

```
0 3 * * * cd /path/to/repo/src && docker compose --profile production run --rm certbot renew \
  --webroot -w /var/www/certbot \
  --deploy-hook "docker compose --profile production restart nginx" \
  >> /var/log/certbot-renew.log 2>&1
```

The `--deploy-hook` only fires (restarting nginx to pick up the new cert) when a cert actually
renews — most days this is a no-op.

## Frontend

Not covered here — `src/frontend` deploys separately as a static `npm run build` output via
GitHub Pages, with `openinvoicexml.de` (apex) DNS pointed at GitHub Pages' IPs. Wiring up the
GitHub Actions build+deploy workflow is a separate, not-yet-done step.
