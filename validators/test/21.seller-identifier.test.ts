import { describe, it, expect } from "vitest";

import { checkSellerIdentifierRequirement } from "../rules/21.seller-identifier.js";
import { validateBusinessRules } from "../engines/02.business-rules.js";
import { validateInvoiceSchema } from "../engines/01.schema.js";
import type { Invoice } from "../../core/index.js";
import type { ValidationIssue } from "../types.js";
import {
  domesticSimple,
  freelancerTaxNumberAsSellerId,
  freelancerBuyerAssignedSupplierId,
} from "../../fixtures/index.js";

function check(seller: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  checkSellerIdentifierRequirement(seller, issues);
  return issues;
}

const required = (issues: ValidationIssue[]): boolean =>
  issues.some((i) => i.code === "SELLER_IDENTIFIER_REQUIRED");

/**
 * | Case                                                    | Result          |
 * |---------------------------------------------------------|-----------------|
 * | vatId / legalId / identifier.id present                 | ok              |
 * | taxRegistrationId (BT-32) + same value as identifier    | ok (fixture 55) |
 * | only taxRegistrationId (BT-32)                          | error           |
 * | whitespace-only values                                  | error           |
 * | identifier with schemeId "SEPA" only                    | error           |
 * | SEPA identifier next to a real legalId                  | ok              |
 * | malformed direct input (non-string id, non-object, ...) | error, no throw |
 */
describe("checkSellerIdentifierRequirement (BR-CO-26)", () => {
  it("accepts a vatId", () => expect(check({ vatId: "DE123456789" })).toEqual([]));
  it("accepts a legalId", () => expect(check({ legalId: "HRB 1" })).toEqual([]));
  it("accepts an identifier without scheme", () =>
    expect(check({ identifier: { id: "X1" } })).toEqual([]));
  it("accepts an identifier with a non-SEPA scheme", () =>
    expect(check({ identifier: { id: "X1", schemeId: "0204" } })).toEqual([]));

  // BT-32 only
  // → valid tax information
  // → but XRechnung BR-CO-26 still fails
  it("rejects a seller with only taxRegistrationId (BT-32), which never satisfies BR-CO-26", () => {
    expect(required(check({ taxRegistrationId: "12/345/67890" }))).toBe(true);
  });

  // BT-32 + BT-29
  // → passes the XRechnung seller identifier rule
  it("accepts the Steuernummer repeated as a scheme-less identifier (FeRD E13, fixture 55)", () => {
    expect(
      check({ taxRegistrationId: "12/345/67890", identifier: { id: "12/345/67890" } }),
    ).toEqual([]);
  });

  it("rejects whitespace-only vatId, legalId and identifier.id", () => {
    expect(required(check({ vatId: "  ", legalId: "\t", identifier: { id: " " } }))).toBe(true);
  });

  it("rejects an identifier whose scheme is SEPA", () => {
    expect(required(check({ identifier: { id: "DE98ZZZ09999999999", schemeId: "SEPA" } }))).toBe(
      true,
    );
  });

  it("does not let a SEPA identifier mask a real legalId", () => {
    expect(check({ legalId: "HRB 1", identifier: { id: "X", schemeId: "SEPA" } })).toEqual([]);
  });

  it("never throws on malformed direct input", () => {
    for (const seller of [
      undefined,
      null,
      "seller",
      {},
      { identifier: "X1" },
      { identifier: null },
      { identifier: { id: 42 } },
      { identifier: {} },
      { vatId: 1, legalId: {} },
    ]) {
      expect(required(check(seller))).toBe(true);
    }
  });
});

describe("validateBusinessRules + BR-CO-26", () => {
  const clone = (): Invoice => JSON.parse(JSON.stringify(domesticSimple)) as Invoice;

  it("flags a true BT-32-only seller", () => {
    const invoice = clone();
    delete invoice.seller.vatId;
    invoice.seller.taxRegistrationId = "12/345/67890";
    const issues = validateBusinessRules(invoice, "XRECHNUNG", { today: "2030-01-01" });
    expect(required(issues)).toBe(true);
  });

  it.each([
    ["55", freelancerTaxNumberAsSellerId],
    ["56", freelancerBuyerAssignedSupplierId],
  ])("accepts fixture %s", (_n, fixture) => {
    const issues = validateBusinessRules(fixture as Invoice, "XRECHNUNG", { today: "2030-01-01" });
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("fixture 56 uses a BT-29 different from the Steuernummer", () => {
    expect(freelancerBuyerAssignedSupplierId.seller.identifier.id).not.toBe(
      freelancerBuyerAssignedSupplierId.seller.taxRegistrationId,
    );
  });
});

describe("schema: Party.identifier", () => {
  const withIdentifier = (identifier: unknown): unknown => {
    const invoice = JSON.parse(JSON.stringify(domesticSimple)) as Invoice;
    invoice.seller.identifier = identifier as NonNullable<Invoice["seller"]["identifier"]>;
    return invoice;
  };
  const ok = (identifier: unknown): boolean =>
    validateInvoiceSchema(withIdentifier(identifier)).length === 0;

  it("accepts id only and id + schemeId", () => {
    expect(ok({ id: "X1" })).toBe(true);
    expect(ok({ id: "X1", schemeId: "0204" })).toBe(true);
  });
  it("rejects empty id, empty schemeId, missing id, unknown keys, overlong id", () => {
    expect(ok({ id: "" })).toBe(false);
    expect(ok({ id: "X", schemeId: "" })).toBe(false);
    expect(ok({ schemeId: "0204" })).toBe(false);
    expect(ok({ id: "X", extra: 1 })).toBe(false);
    expect(ok({ id: "x".repeat(501) })).toBe(false);
  });
});
