CREATE TABLE beta_signups (
  id             SERIAL PRIMARY KEY,
  name           TEXT,
  email          TEXT NOT NULL UNIQUE,
  role           TEXT NOT NULL,
  role_other     TEXT,
  message        TEXT,
  consent        BOOLEAN NOT NULL,
  wants_contact  BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
