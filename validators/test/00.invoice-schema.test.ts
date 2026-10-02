// The schema checks run through validateInvoiceSchema(), the same exported function
// generateInvoice() uses, so these tests cover the real runtime path instead of a private copy of
// the AJV setup. It returns [] for a valid invoice and ValidationIssue[] otherwise.
//
// with { type: "json" } tells Node.js and TypeScript "this is JSON data, not executable code".
import simpleFixture from "../../fixtures/01.domestic-simple.invoice.json" with { type: "json" };
import multiLineFixture from "../../fixtures/02.domestic-multi-line.invoice.json" with { type: "json" };
// describe() → groups related tests together.
// it() → runs one test.
// expect() → checks if the result is correct.
import { describe, it, expect } from "vitest";
import { validateInvoiceSchema } from "../engines/01.schema.js";

/** True when the schema accepts `data`; the tests below read it like a yes/no check. */
function validate(data: unknown): boolean {
  return validateInvoiceSchema(data).length === 0;
}

/** True when a missing-property error was reported for the given path (e.g. "id", "seller"). */
function reportsMissing(data: unknown, path: string): boolean {
  return validateInvoiceSchema(data).some((i) => i.code === "SCHEMA_REQUIRED" && i.path === path);
}

// Shared shape for both fixtures, used so generic mutation tests can run against either one.
type Invoice = typeof simpleFixture;

const fixtures: [string, Invoice][] = [
  ["domestic-simple", simpleFixture],
  ["domestic-multi-line", multiLineFixture],
];

/**
 * What's tested here (schemas/invoice.schema.json, via AJV):
 *
 * | Describe block                    | Fixture(s)                           | Checks                                                                                        |
 * |------------------------------------|----------------------------------------|--------------------------------------------------------------------------------------------------|
 * | valid fixtures                     | domestic-simple, domestic-multi-line   | both fixtures pass schema validation as-is                                                       |
 * | required field enforcement         | both (via describe.each)               | id/issueDate/seller/buyer required; lines/vatBreakdowns can't be empty                            |
 * | type and format enforcement        | both                                   | typeCode, issueDate format, currencyCode case, vatRate range, countryCode length, vatCategoryCode |
 * | additionalProperties enforcement   | both                                   | unknown top-level and line-item fields rejected (additionalProperties: false)                    |
 * | delivery (BG-13/BG-15)             | both                                   | nested deliverTo shape required; old flat delivery fields rejected; countryCode mandatory         |
 * | multi-line specific checks         | domestic-multi-line only               | schema violations on non-first lines (index 1, 2) are caught too, not just line 0                 |
 */
describe("Invoice JSON Schema", () => {
  describe("valid fixtures", () => {
    it("accepts 01.domestic-simple.invoice.json", () => {
      expect(validateInvoiceSchema(simpleFixture)).toEqual([]);
    });

    it("accepts 02.domestic-multi-line.invoice.json", () => {
      expect(validateInvoiceSchema(multiLineFixture)).toEqual([]);
    });
  });

  describe.each(fixtures)("required field enforcement (%s)", (_label, fixture) => {
    it("rejects an invoice missing 'id'", () => {
      // ex)
      // const _id = Fixture.id

      // const noId = {
      //   issueDate: Fixture.issueDate,
      //   seller: Fixture.seller,
      //   ...all other properties except id
      // };
      const { id: _id, ...noId } = fixture;
      // Validate the invoice without an id.
      expect(validate(noId)).toBe(false);
      // The issue is { code: "SCHEMA_REQUIRED", path: "id", severity: "error", ... }.
      expect(reportsMissing(noId, "id")).toBe(true);
    });

    it("rejects an invoice missing 'issueDate'", () => {
      const { issueDate: _d, ...noDate } = fixture;
      expect(validate(noDate)).toBe(false);
      expect(reportsMissing(noDate, "issueDate")).toBe(true);
    });

    it("rejects an invoice missing 'seller'", () => {
      const { seller: _s, ...noSeller } = fixture;
      expect(validate(noSeller)).toBe(false);
      expect(reportsMissing(noSeller, "seller")).toBe(true);
    });

    it("rejects an invoice missing 'buyer'", () => {
      const { buyer: _b, ...noBuyer } = fixture;
      expect(validate(noBuyer)).toBe(false);
      expect(reportsMissing(noBuyer, "buyer")).toBe(true);
    });

    it("rejects an invoice with an empty 'lines' array", () => {
      const bad = {
        ...fixture,
        lines: [],
      };
      expect(validate(bad)).toBe(false);
    });

    it("rejects an invoice with an empty 'vatBreakdowns' array", () => {
      const bad = {
        ...fixture,
        vatBreakdowns: [],
      };
      expect(validate(bad)).toBe(false);
    });
  });

  describe.each(fixtures)("type and format enforcement (%s)", (_label, fixture) => {
    it("rejects an invalid typeCode", () => {
      const bad = {
        ...fixture,
        typeCode: "999",
      };
      expect(validate(bad)).toBe(false);
    });

    it("rejects a non-date issueDate (DD/MM/YYYY format)", () => {
      const bad = {
        ...fixture,
        issueDate: "09/06/2026",
      };
      expect(validate(bad)).toBe(false);
    });

    it("rejects a lowercase currencyCode", () => {
      const bad = {
        ...fixture,
        currencyCode: "eur",
      };
      expect(validate(bad)).toBe(false);
    });

    it("rejects a vatRate above 100", () => {
      const bad = {
        ...fixture,
        lines: [{ ...fixture.lines[0]!, vatRate: 101 }],
      };
      expect(validate(bad)).toBe(false);
    });

    it("rejects a countryCode longer than 2 characters", () => {
      const bad = {
        ...fixture,
        seller: {
          ...fixture.seller,
          address: { ...fixture.seller.address, countryCode: "DEU" },
        },
      };
      expect(validate(bad)).toBe(false);
    });

    it("rejects an unknown vatCategoryCode", () => {
      const bad = {
        ...fixture,
        lines: [{ ...fixture.lines[0]!, vatCategoryCode: "X" }],
      };
      expect(validate(bad)).toBe(false);
    });
  });

  describe.each(fixtures)("additionalProperties enforcement (%s)", (_label, fixture) => {
    it("rejects an invoice with an unrecognised top-level field", () => {
      const bad = {
        ...fixture,
        unknownField: "surprise",
      };
      expect(validate(bad)).toBe(false);
    });

    it("rejects a line item with an unrecognised field", () => {
      const bad = {
        ...fixture,
        lines: [{ ...fixture.lines[0]!, discount: 10 }],
      };
      expect(validate(bad)).toBe(false);
    });
  });

  describe.each(fixtures)("delivery (BG-13/BG-15) (%s)", (_label, fixture) => {
    it("accepts a delivery.deliverTo address with a country code", () => {
      const good = {
        ...fixture,
        delivery: {
          actualDeliveryDate: "2026-07-20",
          deliverTo: { city: "Paris", postalCode: "75001", countryCode: "FR" },
        },
      };
      expect(validate(good)).toBe(true);
    });

    it("rejects the old flat delivery fields", () => {
      const bad = {
        ...fixture,
        delivery: { city: "Paris", postalCode: "75001", countryCode: "FR" },
      };
      expect(validate(bad)).toBe(false);
    });

    it("rejects a deliverTo address missing countryCode", () => {
      const bad = {
        ...fixture,
        delivery: { deliverTo: { city: "Paris" } },
      };
      expect(validate(bad)).toBe(false);
    });
  });

  describe("multi-line specific checks", () => {
    it("rejects when a non-first line has an unrecognised field", () => {
      const bad = {
        ...multiLineFixture,
        lines: [
          multiLineFixture.lines[0]!,
          { ...multiLineFixture.lines[1]!, discount: 10 },
          multiLineFixture.lines[2]!,
        ],
      };
      expect(validate(bad)).toBe(false);
    });

    it("rejects when a non-first line has a vatRate above 100", () => {
      const bad = {
        ...multiLineFixture,
        lines: [
          multiLineFixture.lines[0]!,
          { ...multiLineFixture.lines[1]!, vatRate: 101 },
          multiLineFixture.lines[2]!,
        ],
      };
      expect(validate(bad)).toBe(false);
    });

    it("rejects when a non-first line has an unknown vatCategoryCode", () => {
      const bad = {
        ...multiLineFixture,
        lines: [
          multiLineFixture.lines[0]!,
          multiLineFixture.lines[1]!,
          { ...multiLineFixture.lines[2]!, vatCategoryCode: "X" },
        ],
      };
      expect(validate(bad)).toBe(false);
    });
  });
});
