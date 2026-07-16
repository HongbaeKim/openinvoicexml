import { pool } from "./db.js";
import type { DeveloperSignupBody } from "./schema.js";

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "23505"
  );
}

export async function insertDeveloperSignup(body: DeveloperSignupBody): Promise<void> {
  const { name, email, role, roleOther, whatToBuild, wantsContact, consent } = body;

  await pool.query(
    `INSERT INTO developer_signups
       (name, email, role, role_other, what_to_build, wants_contact, consent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      name ?? null,
      email,
      role,
      role === "other" ? (roleOther ?? null) : null,
      whatToBuild ?? null,
      wantsContact ?? false,
      consent,
    ],
  );
}
