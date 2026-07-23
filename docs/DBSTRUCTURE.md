# Database structure

Two tables, one per signup form (`src/db/001_create_beta_signups.sql`,
`src/db/002_create_developer_signups.sql`). Both are plain Postgres tables with no
separate migration tool — Postgres auto-runs every `.sql` file in `src/db/` on first
boot of an empty data directory (see `docker-compose.yml`'s `postgres` service).

## `beta_signups`

| Column          | Type          | Constraint                   | Notes                                                                                 |
| --------------- | ------------- | ---------------------------- | ------------------------------------------------------------------------------------- |
| `id`            | `SERIAL`      | `PRIMARY KEY`                |                                                                                       |
| `name`          | `TEXT`        | required (API-level, not DB) |                                                                                       |
| `email`         | `TEXT`        | `NOT NULL UNIQUE`            | the only uniqueness constraint on this table                                          |
| `role`          | `TEXT`        | `NOT NULL`                   | e.g. `freelancer`, `small-business`, `other`                                          |
| `role_other`    | `TEXT`        | nullable                     | only set when `role = 'other'`; `NULL` otherwise, even if the client sends stray data |
| `message`       | `TEXT`        | nullable                     | optional "anything else?" field, beta form only                                       |
| `consent`       | `BOOLEAN`     | `NOT NULL`                   | GDPR consent checkbox                                                                 |
| `wants_contact` | `BOOLEAN`     | `NOT NULL DEFAULT false`     |                                                                                       |
| `created_at`    | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()`     |                                                                                       |

## `developer_signups`

| Column          | Type          | Constraint                   | Notes                                                                  |
| --------------- | ------------- | ---------------------------- | ---------------------------------------------------------------------- |
| `id`            | `SERIAL`      | `PRIMARY KEY`                |                                                                        |
| `name`          | `TEXT`        | required (API-level, not DB) |                                                                        |
| `email`         | `TEXT`        | `NOT NULL UNIQUE`            | the only uniqueness constraint on this table                           |
| `role`          | `TEXT`        | `NOT NULL`                   | e.g. `software-developer`, `erp-developer`, `other`                    |
| `role_other`    | `TEXT`        | nullable                     | same rule as `beta_signups.role_other`                                 |
| `what_to_build` | `TEXT`        | nullable                     | developer form's free-text field (`beta_signups.message`'s equivalent) |
| `wants_contact` | `BOOLEAN`     | `NOT NULL DEFAULT false`     |                                                                        |
| `consent`       | `BOOLEAN`     | `NOT NULL`                   | GDPR consent checkbox                                                  |
| `created_at`    | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()`     |                                                                        |

The two tables are independent — no foreign key between them. Someone can sign up for
both the beta and the developer list with the same email; the `UNIQUE` constraint only
prevents duplicates _within_ a single table.

## Duplicate signups: what "already_signed_up" means

`email` is the **only** column either table treats as unique — nothing else (`name`,
`role`, `message`/`what_to_build`, etc.) is checked for duplicates, and a duplicate
`email` is detected even if every other field in the new submission differs from the
original row.

Flow (identical in `src/backend/src/800-beta/` and `.../900-developer/`, one file pair
per form):

1. `routes.ts` calls `insert*Signup(request.body)` (`repository.ts`), a plain `INSERT`.
2. If `email` already exists, Postgres raises error code `23505` (`unique_violation`)
   instead of the row being inserted.
3. `repository.ts`'s `isUniqueViolation(err)` checks for exactly that code:
   ```ts
   export function isUniqueViolation(err: unknown): boolean {
     return (
       typeof err === "object" &&
       err !== null &&
       "code" in err &&
       (err as { code: unknown }).code === "23505"
     );
   }
   ```
4. `routes.ts`'s `catch` block reacts to the answer — this is the only place that
   actually produces the `"already_signed_up"` string:
   ```ts
   } catch (err) {
     if (isUniqueViolation(err)) {
       return reply.code(200).send({ status: "already_signed_up" });
     }
     request.log.error(err);
     return reply.code(500).send({ error: "internal error" });
   }
   ```
   Note this returns HTTP `200`, not an error status — a repeat signup is treated as a
   successful outcome from the client's point of view, not a failure.
5. On the frontend, `BetaForm.tsx`/`DeveloperForm.tsx` both treat `ok` (HTTP 2xx) as
   success regardless of which branch fired, and only pick a different message string
   based on `result.status`:
   ```ts
   text: result.status === "already_signed_up" ? t.alreadySignedUp : t.success,
   ```
   Nothing else about the UI differs — same green "success" styling either way, no
   second row inserted, and the new submission's other field values (name, role, etc.)
   are silently discarded rather than merged into the existing row.

This works safely only because each table has exactly one `UNIQUE` constraint. Neither
`isUniqueViolation` nor `routes.ts` inspects _which_ column caused a `23505` — if a
second `UNIQUE` column were ever added to either table, a violation on that new column
would also be misreported as `already_signed_up`.

## Field length limits

Enforced by the `ajv` JSON-schema validation in `src/backend/src/800-beta/schema.ts` and
`.../900-developer/schema.ts` (`bodySchema`) — this is the actual enforcement layer; a
request exceeding these gets rejected with `400` before it ever reaches the database.
The frontend forms (`BetaForm.tsx`/`DeveloperForm.tsx`) mirror the same numbers via each
`<input>`/`<textarea>`'s `maxLength` attribute, but that's UX only (stops the browser
from letting you type past it) — the backend schema is the source of truth.

| Field                                        | Max length | Notes                                                                                                                                                                                                |
| -------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                                       | 200        |                                                                                                                                                                                                      |
| `email`                                      | 320        | RFC 5321's actual maximum length for a valid email address — not arbitrary                                                                                                                           |
| `role`                                       | 50         |                                                                                                                                                                                                      |
| `roleOther`                                  | 100        | only validated/required when `role === "other"`                                                                                                                                                      |
| `message` (beta) / `whatToBuild` (developer) | 2000       | free-text "tell us more" field                                                                                                                                                                       |
| `website` (honeypot)                         | 200        | hidden field; any non-empty value here silently short-circuits the submission as spam (see `routes.ts`'s `if (website) return reply.code(201).send({ status: "ok" })` — accepted but never inserted) |

Both `email` (`minLength: 3`) and `name` (`minLength: 1`) also have a minimum; other
fields have no minimum beyond what `required` already implies.

## Inspecting the data

```sh
make db-psql          # drops straight into psql (make db for a plain shell instead)
```

```sql
\dt                                      -- list tables
\d beta_signups                          -- describe columns
SELECT * FROM beta_signups;
SELECT * FROM developer_signups;
SELECT email, count(*) FROM beta_signups GROUP BY email HAVING count(*) > 1;  -- should always be empty
```
