import { describe, it, expect } from "vitest";

import { validateInvoiceSchema } from "../engines/01.schema.js";
import { allFixtures, domesticSimple } from "../../fixtures/index.js";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("validateInvoiceSchema", () => {
  it.each(allFixtures)("accepts fixture %s", (_label, fixture) => {
    expect(validateInvoiceSchema(fixture)).toEqual([]);
  });

  describe("issue shape", () => {
    it("reports error-severity issues with code, message and path", () => {
      const bad = clone(domesticSimple) as Record<string, unknown>;
      delete bad.id;
      const issues = validateInvoiceSchema(bad);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual({
        code: "SCHEMA_REQUIRED",
        severity: "error",
        message: "id must have required property 'id'",
        path: "id",
      });
    });

    it("formats nested array paths like validateBusinessRules does", () => {
      const bad = clone(domesticSimple) as { lines: Record<string, unknown>[] };
      bad.lines[0]!.vatCategoryCode = "Q";
      const issues = validateInvoiceSchema(bad);
      expect(issues.map((i) => i.path)).toContain("lines[0].vatCategoryCode");
    });

    // 1 can be anything that is not a valid property name, 
    // so the path formatter has to handle it correctly.
    it("names the offending property for additionalProperties errors", () => {
      const bad = { ...clone(domesticSimple), surprise: 1 };
      expect(validateInvoiceSchema(bad).map((i) => i.path)).toContain("surprise");
    });

    it("reports every problem in one pass, not just the first", () => {
      const bad = clone(domesticSimple) as Record<string, unknown>;
      delete bad.id;
      delete bad.seller;
      bad.currencyCode = "euro";
      expect(validateInvoiceSchema(bad).length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("input that is not an object at all", () => {
    it.each([
      ["null", null],
      ["undefined", undefined],
      ["a string", "invoice"],
      ["a number", 42],
      ["an array", []],
      ["an empty object", {}],
    ])("returns issues instead of throwing for %s", (_label, input) => {
      const issues = validateInvoiceSchema(input);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.every((i) => i.severity === "error")).toBe(true);
    });
  });

  describe("string length caps", () => {
    it("rejects a note longer than the free-text cap", () => {
      const bad = { ...clone(domesticSimple), note: "x".repeat(10_001) };
      expect(validateInvoiceSchema(bad).map((i) => i.path)).toContain("note");
    });

    it("accepts a note at the cap", () => {
      const ok = { ...clone(domesticSimple), note: "x".repeat(10_000) };
      expect(validateInvoiceSchema(ok)).toEqual([]);
    });

    it("rejects an over-long short field (seller name)", () => {
      const bad = clone(domesticSimple) as { seller: { name: string } };
      bad.seller.name = "x".repeat(501);
      expect(validateInvoiceSchema(bad).map((i) => i.path)).toContain("seller.name");
    });
  });
});
