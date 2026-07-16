export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const bodySchema = {
  type: "object",
  required: ["name", "email", "consent", "role"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    email: { type: "string", minLength: 3, maxLength: 320 },
    consent: { type: "boolean" },
    role: { type: "string", minLength: 1, maxLength: 50 },
    roleOther: { type: "string", maxLength: 100 },
    message: { type: "string", maxLength: 2000 },
    wantsContact: { type: "boolean" },
    // Honeypot: real visitors never fill this (hidden via CSS). Bots that fill every field trip it.
    website: { type: "string", maxLength: 200 },
  },
  additionalProperties: false,
} as const;

export interface BetaSignupBody {
  name: string;
  email: string;
  consent: boolean;
  role: string;
  roleOther?: string;
  message?: string;
  wantsContact?: boolean;
  website?: string;
}
