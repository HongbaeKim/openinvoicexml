.PHONY: up build down all \
	deploy-certs-bootstrap deploy-frontend deploy-nginx deploy-up deploy-down deploy-logs deploy-renew product-all \
	db db-psql

all: down build up

up:
	docker compose up -d

build:
	docker compose build

down:
	docker compose down

# --- Production (VPS) targets — see DEPLOY.md for full context and one-time setup ---

# One-time, first deploy only: bootstrap TLS certs for both domains. Must run before
# deploy-up, since nginx refuses to boot at all with missing cert files (config loads
# atomically) — see DEPLOY.md step 2.
deploy-certs-bootstrap:
	docker compose --profile production run --rm -p 80:80 certbot certonly \
		--standalone -d api.openinvoicexml.de \
		--email contact@openinvoicexml.de --agree-tos -n
	docker compose --profile production run --rm -p 80:80 certbot certonly \
		--standalone -d openinvoicexml.de \
		--email contact@openinvoicexml.de --agree-tos -n

# Build the frontend static site into ./frontend/dist, which nginx serves read-only.
# Run again after every frontend change — no nginx restart needed, it serves files
# straight off disk.
deploy-frontend:
	docker compose --profile production run --rm frontend-build

deploy-nginx:
	docker compose --profile production up -d nginx

# Start (or pick up changes to) the full production stack: postgres, backend, nginx.
deploy-up:
	docker compose --profile production up -d postgres backend nginx

deploy-down:
	docker compose --profile production down

deploy-logs:
	docker compose --profile production logs -f

# Manual cert renewal — normally handled by the host cron job from DEPLOY.md step 5;
# this target is for running it by hand. Renews every cert Certbot manages, so it
# covers both domains in one call.
deploy-renew:
	docker compose --profile production run --rm certbot renew \
		--webroot -w /var/www/certbot \
		--deploy-hook "docker compose --profile production restart nginx"

# Routine "redeploy everything" after a `git pull` — production counterpart to `all` above.
# Rebuilds the frontend static site and the backend image, then brings the stack up.
# Does NOT bootstrap certs — that's a one-time-only first-deploy step (deploy-certs-bootstrap),
# and re-running --standalone here would conflict with nginx already holding port 80.
product-all: deploy-frontend
	docker compose --profile production up -d --build postgres backend nginx


# DB
# `make db` drops you into the postgres container's shell. From there, connect to the
# actual database with:
#   psql -U app -d app
# Once in psql, useful commands:
#   \dt                                     list tables
#   \d beta_signups                         describe a table's columns
#   SELECT * FROM beta_signups;             view beta signups
#   SELECT * FROM developer_signups;        view developer signups
#   \q                                      quit psql (then `exit` to leave the shell)
db:
	docker exec -it src-postgres-1 sh

# Same as above but skips the intermediate shell — drops straight into psql.
db-psql:
	docker exec -it src-postgres-1 psql -U app -d app

