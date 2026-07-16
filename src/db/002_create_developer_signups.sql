CREATE TABLE developer_signups (
  id             SERIAL PRIMARY KEY,
  name           TEXT,
  email          TEXT NOT NULL UNIQUE,
  role           TEXT NOT NULL,
  role_other     TEXT,
  what_to_build  TEXT,
  wants_contact  BOOLEAN NOT NULL DEFAULT false,
  consent        BOOLEAN NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
