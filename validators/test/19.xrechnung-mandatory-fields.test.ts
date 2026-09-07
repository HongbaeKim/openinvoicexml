import { describe, it, expect } from "vitest";

import { checkXRechnungBuyerReferenceRequirement } from "../rules/19.xrechnung-mandatory-fields.js";
import type { ValidationIssue } from "../types.js";

function check(buyerReference: string | undefined, profile: "EN16931" | "XRECHNUNG"): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  checkXRechnungBuyerReferenceRequirement(buyerReference, profile, issues);
  return issues;
}

describe("checkXRechnungBuyerReferenceRequirement", () => {
  it("does not flag an empty-string buyer reference under EN16931", () => {
    expect(check("", "EN16931")).toEqual([]);
  });

  it("does not flag a missing buyer reference under EN16931", () => {
    expect(check(undefined, "EN16931")).toEqual([]);
  });

  it("flags a missing buyer reference under XRECHNUNG", () => {
    const issues = check(undefined, "XRECHNUNG");
    expect(issues.some((i) => i.code === "XRECHNUNG_BUYER_REFERENCE_REQUIRED")).toBe(true);
  });

  it("flags an empty-string buyer reference under XRECHNUNG", () => {
    const issues = check("", "XRECHNUNG");
    expect(issues.some((i) => i.code === "XRECHNUNG_BUYER_REFERENCE_REQUIRED")).toBe(true);
  });

  it("accepts a present buyer reference under XRECHNUNG", () => {
    expect(check("04011000-12345-03", "XRECHNUNG")).toEqual([]);
  });
});
