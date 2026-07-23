# Deploying (VPS)

The backend API and the frontend static site both deploy to the same VPS, fronted by the same
nginx. Prerequisites: a VPS with Docker + Docker Compose installed, and DNS for
`api.openinvoicexml.de`, `openinvoicexml.de` (apex), and `www.openinvoicexml.de` already pointed
at the VPS's IP (A records — propagation must be complete before requesting certs, or the ACME
challenge will fail). `www` only ever 301-redirects to the apex (see nginx.conf) — it doesn't
serve content of its own, but it still needs DNS + a cert so the redirect can happen over HTTPS.

## 1. First-time setup

```sh
git clone <repo> && cd <repo>/src
cp .env.example .env
# edit .env: set ALLOWED_ORIGIN=https://openinvoicexml.de, and change BOTH DATABASE_URL and
# POSTGRES_PASSWORD to the same real password (not the "app:app" dev default) — they're
# independent variables that must match, see docker-compose.yml's comments
```

**Important:** `POSTGRES_PASSWORD` only takes effect the first time Postgres initializes its
data directory. Set the real password in `.env` _before_ the first `docker compose up` —
changing it afterwards on an already-running deployment does nothing silently (the volume
already has the old password baked in) until you either wipe the volume (destroys data) or
change it manually inside Postgres (`ALTER USER app WITH PASSWORD '...'`) and update
`DATABASE_URL` to match.

## 2. Bootstrap the first TLS certs

nginx's config hardcodes paths to cert files that don't exist yet — with them missing, nginx
refuses to start at all (it loads its config atomically), including the port-80 blocks that
would otherwise serve the ACME challenge. So the very first certs have to be obtained **before
nginx starts**, using Certbot's `--standalone` mode (it binds port 80 itself, briefly — fine,
since nothing else is listening on it yet). Two separate domains, two separate certs — kept
independent so renewal or expiry of one never affects the other:

```sh
docker compose --profile production run --rm -p 80:80 certbot certonly \
  --standalone -d api.openinvoicexml.de \
  --email contact@openinvoicexml.de --agree-tos -n

docker compose --profile production run --rm -p 80:80 certbot certonly \
  --standalone -d openinvoicexml.de -d www.openinvoicexml.de \
  --email contact@openinvoicexml.de --agree-tos -n
```

`www.openinvoicexml.de` is issued as a second name (SAN) on the same apex cert lineage, not a
separate cert — nginx's `www` server block only redirects, so it reuses the apex's cert files
directly (see nginx.conf).

> Already have a running deployment whose apex cert predates `www` support? Expand the existing
> lineage in place instead of re-bootstrapping, using `--webroot` since nginx already owns port 80:
>
> ```sh
> docker compose --profile production run --rm certbot certonly \
>   --webroot -w /var/www/certbot --cert-name openinvoicexml.de \
>   -d openinvoicexml.de -d www.openinvoicexml.de --expand \
>   --email contact@openinvoicexml.de --agree-tos -n
> ```
>
> Then restart nginx to pick up the new cert: `docker compose --profile production restart nginx`.

## 3. Build the frontend

```sh
docker compose --profile production run --rm frontend-build
```

Produces `src/frontend/dist`, which nginx mounts read-only as its docroot (see step 4). Unlike
the certs above, this isn't a hard boot dependency — nginx will start fine without it and just
serve 404s from an empty docroot — but do it first anyway so the site is actually live once
nginx comes up.

## 4. Start the stack

```sh
docker compose --profile production up -d
```

nginx now starts successfully (the certs from step 2 exist) and owns port 80/443 going forward,
serving both `api.openinvoicexml.de` (reverse-proxied to the backend) and `openinvoicexml.de`
(static files from step 3). Verify: `curl https://api.openinvoicexml.de/health` →
`{"status":"ok"}`, and `https://openinvoicexml.de` loads the site.

## 5. Set up renewal

nginx owns port 80 continuously from now on, so all renewals after the first use `--webroot`
instead of `--standalone`. Docker Compose has no built-in scheduler, so this is a host cron job.
`certbot/renew.sh` wraps the actual renewal command (a single `certbot renew` renews every cert
it manages, so one script call covers both domains); `certbot/crontab` holds the schedule for
it. Install it with:

```sh
make deploy-cron-install
```

This merges `certbot/crontab`'s entry into your real crontab rather than replacing it — safe
even if this VPS already runs cron jobs for other projects (`crontab < file` would wipe those
out; the install script specifically avoids that, and is safe to re-run). If the repo doesn't
live at `~/openinvoicexml`, edit the path in `certbot/crontab` first.

The script's `--deploy-hook` only fires (restarting nginx to pick up the new cert) when a cert
actually renews — most days this is a no-op. Run it by hand any time with `make deploy-renew`,
or test the whole flow without touching the real cert via
`docker compose --profile production run --rm certbot renew --dry-run`.

## Redeploying later

Backend changes: `git pull`, `docker compose --profile production up -d --build backend`.

Frontend changes: `git pull`, `docker compose --profile production run --rm frontend-build`.
No nginx restart needed — nginx serves the files straight off disk on every request, so a
rebuilt `dist/` takes effect immediately.
