import type { EInvoiceProfile } from "../../core/types/profile.js";
import type { ValidationIssue } from "../types.js";

/**
 * Checks XRechnung 3.0's CIUS-specific tightening of BT-10 Buyer reference to cardinality 1
 * (mandatory) — EN 16931 itself leaves it optional. Only applies when profile is "XRECHNUNG";
 * plain EN16931 output is unaffected.
 *
 * Presence-only: does not validate Leitweg-ID format. XRechnung's own FAQ confirms BT-10 need
 * not be a Leitweg-ID for B2B use — only some B2G recipients require that specific format.
 *
 * @see ../../docs/COMPLIANCE.md for the XRechnung 3.0.2 spec source.
 */
export function checkXRechnungBuyerReferenceRequirement(
  buyerReference: string | undefined,
  profile: EInvoiceProfile,
  issues: ValidationIssue[],
): void {
  if (profile !== "XRECHNUNG") return;
  if (buyerReference) return;

  issues.push({
    code: "XRECHNUNG_BUYER_REFERENCE_REQUIRED",
    severity: "error",
    message:
      "buyerReference: BT-10 buyer reference is mandatory under the XRechnung 3.0 CIUS " +
      "(cardinality 1), even though EN 16931 itself leaves it optional.",
    path: "buyerReference",
  });
}
