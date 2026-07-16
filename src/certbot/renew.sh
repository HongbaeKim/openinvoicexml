#!/bin/sh
# Run by cron (see DEPLOY.md's renewal step) and by `make deploy-renew`. Renews every cert
# Certbot manages under /etc/letsencrypt — currently api.openinvoicexml.de and
# openinvoicexml.de — in one call; it's a no-op for any cert not within its renewal window.
# --webroot (not --standalone) since nginx already owns port 80/443 continuously past the
# first bootstrap — see DEPLOY.md step 2 for why that first cert needed --standalone instead.
set -eu
cd "$(dirname "$0")/.."

docker compose --profile production run --rm certbot renew \
  --webroot -w /var/www/certbot \
  --deploy-hook "docker compose --profile production restart nginx"
