import type { ValidationIssue } from "../types.js";

function isNonBlank(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * BR-CO-26: the seller must carry at least one of BT-29 (`identifier`), BT-30 (`legalId`) or
 * BT-31 (`vatId`). BT-32 (`taxRegistrationId`, Steuernummer) never counts, and neither does a
 * BT-29 whose scheme is "SEPA" (the published rule's XPath excludes SEPA-scheme
 * PartyIdentification IDs). Whitespace-only values do not count.
 *
 * Takes `unknown` and never throws: `validateBusinessRules()` can be called without prior
 * schema validation, so every field may be missing or the wrong type.
 *
 * @see ../../docs/COMPLIANCE.md
 */
export function checkSellerIdentifierRequirement(seller: unknown, issues: ValidationIssue[]): void {
  const party = (typeof seller === "object" && seller !== null ? seller : {}) as Record<
    string,
    unknown
  >;
  const identifier =
    typeof party.identifier === "object" && party.identifier !== null
      ? (party.identifier as Record<string, unknown>)
      : undefined;

  const hasIdentifier =
    identifier !== undefined && isNonBlank(identifier.id) && identifier.schemeId !== "SEPA";
  if (hasIdentifier || isNonBlank(party.legalId) || isNonBlank(party.vatId)) return;

  issues.push({
    code: "SELLER_IDENTIFIER_REQUIRED",
    severity: "error",
    message:
      "seller.identifier: BR-CO-26 requires at least one of BT-29 (seller identifier), BT-30 (legal registration identifier) or BT-31 (VAT identifier); BT-32 (tax registration number) does not count.",
    path: "seller.identifier",
  });
}
