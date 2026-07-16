// Anything served from the production apex domain talks to the production API; everything else
// (localhost, 127.0.0.1, a LAN IP like 192.168.x.x when accessing a remote dev box from another
// device — BIND_HOST=0.0.0.0 case, see .env.example) talks to that same host's backend port.
// This is deliberately not an allowlist of specific dev hostnames, since those vary by network.
const API_BASE =
  window.location.hostname === "openinvoicexml.de"
    ? "https://api.openinvoicexml.de"
    : `http://${window.location.hostname}:3000`;

export interface ApiResponse {
  status?: string;
  error?: string;
}

export interface BetaSignupPayload {
  name: string;
  email: string;
  consent: boolean;
  role: string;
  roleOther: string;
  message: string;
  wantsContact: boolean;
  website: string;
}

export type BetaSignupResponse = ApiResponse;

export async function submitBetaSignup(
  payload: BetaSignupPayload,
): Promise<{ ok: boolean; result: BetaSignupResponse }> {
  const res = await fetch(`${API_BASE}/api/beta`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await res.json().catch(() => ({}))) as BetaSignupResponse;
  return { ok: res.ok, result };
}

export interface DeveloperSignupPayload {
  name: string;
  email: string;
  consent: boolean;
  role: string;
  roleOther: string;
  whatToBuild: string;
  wantsContact: boolean;
  website: string;
}

export type DeveloperSignupResponse = ApiResponse;

export async function submitDeveloperSignup(
  payload: DeveloperSignupPayload,
): Promise<{ ok: boolean; result: DeveloperSignupResponse }> {
  const res = await fetch(`${API_BASE}/api/developer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await res.json().catch(() => ({}))) as DeveloperSignupResponse;
  return { ok: res.ok, result };
}
