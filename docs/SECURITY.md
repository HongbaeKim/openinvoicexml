# nginx hardening (pre-launch)

`src/nginx/nginx.conf` started as the minimum needed to function: HTTP→HTTPS redirect, the ACME
webroot challenge, TLS termination, and a plain reverse proxy to `backend:3000`. None of the usual
pre-launch hardening was in place. This is the pass done before `api.openinvoicexml.de` opens to
the public, and the reasoning behind each piece, so it doesn't need to be re-derived later.

Scope is nginx only — this is the single public-facing entry point (backend is bound to loopback,
see `docker-compose.yml`'s comments), so headers, TLS policy, and rate limiting all belong here
rather than in the app. Backend-level hardening is listed separately under **Deferred**, below.

This nginx now fronts two origins, not one: `api.openinvoicexml.de` (reverse proxy to the
backend, the focus of most of this doc) and `openinvoicexml.de` (the static frontend build,
served directly — originally planned for GitHub Pages, moved onto this same VPS/nginx instead).
Most of the hardening below was written with only the API origin in mind; where that origin split
changes the reasoning, it's called out inline.

Context for _why this matters now_: the backend currently exposes exactly three routes —
`GET /health`, `POST /api/beta`, `POST /api/developer` (both signup forms, already have a
honeypot `website` field client-side, no auth, no file uploads). So the realistic pre-launch risk
is unauthenticated signup-form spam and generic opportunistic scanning against a freshly-DNS'd
domain — not anything upload- or auth-related yet. That shaped the choices below.

## TLS

- `ssl_protocols TLSv1.2 TLSv1.3;` — drops TLS 1.0/1.1, both long deprecated.
- Explicit `ssl_ciphers` restricted to modern AEAD suites (ECDHE + GCM/ChaCha20-Poly1305), with
  `ssl_prefer_server_ciphers off;` — safe to leave cipher choice to the client once the list itself
  only contains modern suites; this is current Mozilla "modern"-profile guidance, not a copied
  legacy list.
- `ssl_session_tickets off;` — session tickets are a known forward-secrecy weak point (key reused
  across restarts unless rotated out-of-band, which this setup doesn't do); session cache instead
  gives resumption without that tradeoff.

## Headers

- `Strict-Transport-Security: max-age=31536000; includeSubDomains` — **no `preload`**. Preload
  submission is a one-way door: browsers ship it in a hardcoded list, and removal takes months and
  applies to the whole domain tree. Too permanent a commitment for a site that hasn't opened yet.
  Can be added later once the deployment has proven stable.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
  a locked-down `Permissions-Policy` — standard defense-in-depth, cheap to add.
- **No `Content-Security-Policy` on the API origin.** `api.openinvoicexml.de` only ever returns
  JSON — it serves no HTML, so there's nothing for a CSP to protect against injection into.
  Omitted deliberately, not an oversight.
- **`openinvoicexml.de` (the frontend) does have one**, since this origin serves HTML directly:
  `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src
'self' https://api.openinvoicexml.de; frame-ancestors 'none'; base-uri 'self'; form-action
'self';`. No `'unsafe-inline'` anywhere — the Vite production build (`@vitejs/plugin-react` +
  `@tailwindcss/vite`, no legacy/polyfill plugin) emits only external `<script type="module">`
  and `<link rel="stylesheet">` tags, no inline script/style, so a strict policy works as-is.
  `connect-src` allowlists exactly the one cross-origin fetch target the frontend legitimately
  calls (`src/frontend/src/000-core/api.ts`). Revisit if either build tooling or the API surface
  changes in a way that needs a new origin or an inline script.
- `server_tokens off;` on both the :80 and :443 server blocks — stops nginx from announcing its
  version in the `Server` response header and default error pages.

## Rate limiting & flood protection

- `limit_req_zone ... rate=5r/m` applied to `location /api/` (covers `/api/beta`, `/api/developer`,
  and automatically covers future `/api/*` routes, e.g. the validation/generation endpoints sketched
  in `.step/limit.md`) — 5 requests/minute per IP with `burst=10 nodelay`. Sized for a human filling
  out a signup form, not for scripted spam. `/health` is intentionally left unlimited so uptime
  checks aren't affected. Returns `429` (`limit_req_status 429;`) rather than nginx's default `503`,
  so a caller can distinguish "rate limited" from "backend down."
- `limit_conn_zone` + `limit_conn addr 20;` — a coarser, path-independent cap on simultaneous
  connections per IP, as a second layer beneath the per-route rate limit.

## Request size & timeouts

- `client_max_body_size 256k;` — today's payloads are just signup-form JSON (name/email/role).
  Explicit and small on purpose. **Revisit this** once any upload endpoint ships (XML/PDF
  validation per `.step/limit.md` — those need multi-MB limits, not 256k).
- `client_body_timeout` / `client_header_timeout` / `send_timeout` all set to `10s` — mitigates
  slow-client (slowloris-style) connection exhaustion; reasonable for a low-traffic pre-launch
  service with no legitimate reason for a slow request.

## Misc

- `location ~ /\. { deny all; }` — blocks dotfile probes, on both server blocks. On the API
  origin this is defense-in-depth with nothing to actually leak (it's a pure reverse proxy); on
  the frontend origin it's load-bearing, since that block now has a real static docroot
  (`/usr/share/nginx/html`) that could otherwise serve stray dotfiles.

## Deferred / future work

Not done now — scope was nginx-only for this pass:

- **Backend-level hardening** (`@fastify/helmet`, `@fastify/rate-limit`) as defense-in-depth behind
  the nginx layer, especially once upload endpoints from `.step/limit.md` exist and nginx alone
  isn't enough to reason about abuse (e.g. per-endpoint limits that differ from the blanket `/api/`
  rule above).
- Revisit `client_max_body_size` (currently 256k) when XML/PDF upload endpoints ship — those need
  limits closer to the 5MB/20MB figures in `.step/limit.md`, scoped to their own `location` blocks
  so the signup routes stay tight.
- HSTS `preload` — reconsider once the deployment has been stable in production for a while.

## Verification checklist (use before opening the site)

1. Syntax check: `docker compose --profile production run --rm nginx nginx -t`.
2. With real certs live: `curl -I https://api.openinvoicexml.de/health` — confirm the new headers
   are present and `Server:` no longer reveals a version string.
3. Rate limit: loop `curl -X POST https://api.openinvoicexml.de/api/beta ...` faster than 5/min and
   confirm it returns `429` once the burst is exhausted, and recovers after.
4. `curl -I https://openinvoicexml.de` — confirm the CSP header is present, then load the site
   with browser devtools open and check for CSP console errors (blocked script/style/connect);
   tighten or loosen the policy based on what's actually needed.
5. Optional: run an SSL scan (Qualys SSL Labs / `testssl.sh`) on both `api.openinvoicexml.de` and
   `openinvoicexml.de` once DNS is live, before announcing the site publicly.
