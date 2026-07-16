# Backend Structure

This document describes the folder convention for `src/backend/src/`: the same numbered-prefix layout used for the frontend (see `docs/FRONTENDSTRUCTURE.md`). It's a target/reference structure — most numbered slices below don't exist yet, since today's backend only serves the beta-program and developer-feedback signup APIs. The near-term plan is a focused product, not a full multi-tenant SaaS: an XML-in/XML-out invoicing feature (wrapping the root-level engine) plus the existing beta/developer signups. There's no accounts/auth/billing system planned right now, so those speculative slices have been dropped from the example tree below — the numbering convention still reserves `300`–`600` for them if that ever changes.

## The convention

The numbered top-level folders use a **hybrid structure**:

- `000` through `200` contain shared infrastructure and application-level composition (config, middleware, route registration) — these are technical layers, not feature slices.
- `300` and above contain domain-oriented **feature slices**. Within a feature slice, its routes, service logic, schema, and types stay together instead of being separated globally by file type — e.g. the invoicing feature's route handler lives in `700-invoicing/routes.ts`, not in a global `200-routes/invoicing.ts`. `200-routes` only registers each feature's routes; it doesn't hold their implementations.
- Numbers normally increment in steps of 100, leaving room to insert an additional slice later without renumbering existing folders.
- Lower numbers are more foundational; higher numbers are more feature-specific.
- Planned slices are reserved in this document but don't need to exist as empty directories — create a new numbered folder when implementation actually starts, not ahead of it.
- The entrypoint (`index.ts`) stays at the `src/` root, not inside a numbered folder.

This is a convention, not a standard architecture — the numbers only buy predictable ordering and reserved room for growth. For a project this size, plain names (`core/`, `features/invoicing/`, ...) would work just as well; numbered slices are used here for 1:1 parity with the frontend structure.

## Slice numbers

| # | Slice | Meaning |
|---|---|---|
| 000 | `core` | Shared config, types — no persistence, no feature/route logic |
| 100 | `middleware` | Fastify plugins: CORS, error handling |
| 200 | `routes` | Route registration root, `/health` — registers each feature's routes, doesn't implement them |
| 300–600 | *(reserved)* | Not currently planned — available for future domain slices (e.g. authentication, customer accounts, billing) if the product grows beyond invoicing + beta/developer signups |
| 700 | `invoicing` | Hosted service layer over the invoice engine — stateless, XML file in/out (planned — next feature) |
| 800 | `beta` | Beta-program signup API for end users — today's actual feature |
| 900 | `developer` | Developer feedback/interest API — today's actual feature |

`000`/`100`/`200` are backend-specific infrastructure concepts (there's no frontend equivalent of "middleware" or "route registration"). If a reserved domain slice (e.g. `300-authentication`) is ever built, use the same number on the frontend (`docs/FRONTENDSTRUCTURE.md`) so the domain stays aligned across stacks.

## Relationship to the invoice engine

The root-level `core/`, `adapters/`, and `validators/` directories (documented in `docs/ARCHITECTURE.md`) are the standalone invoice-generation engine — they have no dependency on `src/backend` or any web-service concern. `700-invoicing` in the tree below is where the hosted API will call into that engine (e.g. accept an invoice file, run `generateInvoice()`, return the generated XML); it's a thin service wrapper, not a duplicate of the engine.

## Persistence

`800-beta` and `900-developer` each use their own database connection (Postgres, via their own `db.ts`) — persistence is a feature-specific dependency, not shared infrastructure, so each slice owns its own `Pool` rather than sharing one in `000-core`. `700-invoicing` is deliberately stateless: input and output are XML (files in, XML out via the engine), with no database involved. If a future slice ever needs persistence, add its own `db.ts` (or repository module) inside that slice rather than growing a shared one in `000-core` — that keeps each feature's storage dependency visible and independently replaceable, mirroring the adapter isolation already used in the invoice engine (`docs/ARCHITECTURE.md`).

## Target example tree

```
src/backend/src/
├── index.ts                      # entrypoint stays at src root
├── 000-core/
│   └── config.ts
├── 100-middleware/
│   ├── cors.ts
│   └── error-handler.ts
├── 200-routes/
│   └── register-routes.ts         # registers betaRoutes(app), developerRoutes(app), ...
├── 700-invoicing/                  # planned — wraps root-level core/adapters/validators engine
│   ├── routes.ts
│   ├── schema.ts
│   ├── service.ts
│   └── file-handling.ts            # reads/writes the XML input/output files
├── 800-beta/
│   ├── routes.ts                   # POST /api/beta
│   ├── schema.ts
│   ├── repository.ts               # beta_signups queries
│   └── db.ts                       # pg pool — only used here
└── 900-developer/
    ├── routes.ts                   # POST /api/developer
    ├── schema.ts
    ├── repository.ts               # developer_signups queries
    └── db.ts                       # pg pool — only used here
```

`200-routes/register-routes.ts` is the central registration point — it imports and wires up each feature's `routes.ts`, but the route handlers themselves live inside their feature slice alongside the service/schema/repository code they depend on.

This tree matches the actual current code for `000`–`200`, `800-beta`, and `900-developer`. `700-invoicing` is still aspirational — the files under it don't exist yet and are shown here as the planned shape once that feature starts.
