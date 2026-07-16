import { pool } from "./db.js";
import type { BetaSignupBody } from "./schema.js";

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "23505"
  );
}

export async function insertBetaSignup(body: BetaSignupBody): Promise<void> {
  const { name, email, role, roleOther, message, consent, wantsContact } = body;

  await pool.query(
    `INSERT INTO beta_signups (name, email, role, role_other, message, consent, wants_contact)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      name ?? null,
      email,
      role,
      role === "other" ? (roleOther ?? null) : null,
      message || null,
      consent,
      wantsContact ?? false,
    ],
  );
}
