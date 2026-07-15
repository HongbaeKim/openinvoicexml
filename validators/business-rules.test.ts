import { describe, it, expect } from "vitest";

import { validateBusinessRules } from "./business-rules.js";
import type { Invoice } from "../core/types/invoice.js";

import domesticSimple from "../fixtures/domestic-simple.invoice.json" with { type: "json" };
import domesticMultiLine from "../fixtures/domestic-multi-line.invoice.json" with { type: "json" };
import reducedRate from "../fixtures/reduced-rate.invoice.json" with { type: "json" };
import exempt from "../fixtures/exempt.invoice.json" with { type: "json" };
import zeroRated from "../fixtures/zero-rated.invoice.json" with { type: "json" };
import reverseCharge from "../fixtures/reverse-charge.invoice.json" with { type: "json" };

const fixtures: [string, unknown][] = [
  ["domestic-simple (19% S)", domesticSimple],
  ["domestic-multi-line (19% S)", domesticMultiLine],
  ["reduced-rate (7% S)", reducedRate],
  ["exempt (E)", exempt],
  ["zero-rated (Z)", zeroRated],
  ["reverse-charge (AE)", reverseCharge],
];

/** Deep-clones a fixture so mutations in one test don't leak into others. */
function clone<T>(fixture: T): T {
  return JSON.parse(JSON.stringify(fixture)) as T;
}

describe("validateBusinessRules", () => {
  describe.each(fixtures)("valid fixtures (%s)", (_label, fixture) => {
    // check valid invoices have no validation errors
    it("returns no issues", () => {
      expect(validateBusinessRules(fixture as Invoice)).toEqual([]);
    });
  });

  it("flags a category 'S' line with a non-positive VAT rate", () => {
    const invoice = clone(domesticSimple) as Invoice;
    invoice.lines[0]!.vatRate = 0;

    const issues = validateBusinessRules(invoice);

    expect(issues.some((i) => i.code === "VAT_RATE_INVALID_FOR_CATEGORY")).toBe(true);
  });

  it("flags a reverse-charge (AE) invoice missing the buyer's VAT ID", () => {
    const invoice = clone(reverseCharge) as Invoice;
    delete invoice.buyer.vatId;

    const issues = validateBusinessRules(invoice);

    expect(issues.some((i) => i.code === "REVERSE_CHARGE_BUYER_VAT_ID_REQUIRED")).toBe(true);
  });

  it("flags an exempt (E) VAT breakdown missing an exemption reason", () => {
    const invoice = clone(exempt) as Invoice;
    delete invoice.vatBreakdowns[0]!.exemptionReason;
    delete invoice.vatBreakdowns[0]!.exemptionReasonCode;

    const issues = validateBusinessRules(invoice);

    expect(issues.some((i) => i.code === "VAT_EXEMPTION_REASON_REQUIRED")).toBe(true);
  });

  it("flags a line amount that doesn't match quantity x unit price", () => {
    const invoice = clone(domesticSimple) as Invoice;
    // will be fail with 1000
    invoice.lines[0]!.lineAmount = 999;

    const issues = validateBusinessRules(invoice);

    expect(issues.some((i) => i.code === "LINE_AMOUNT_ROUNDING")).toBe(true);
  });

  it("flags a VAT breakdown taxable amount that doesn't match the summed line amounts", () => {
    const invoice = clone(domesticSimple) as Invoice;
    // will be fail with 1000
    invoice.vatBreakdowns[0]!.taxableAmount = 2000;

    const issues = validateBusinessRules(invoice);

    expect(issues.some((i) => i.code === "VAT_TAXABLE_AMOUNT_MISMATCH")).toBe(true);
  });

  it("flags a VAT breakdown tax amount that doesn't match taxable amount x rate", () => {
    const invoice = clone(domesticSimple) as Invoice;
    // will be fail with 190
    invoice.vatBreakdowns[0]!.taxAmount = 100;

    const issues = validateBusinessRules(invoice);

    expect(issues.some((i) => i.code === "VAT_TAX_AMOUNT_ROUNDING")).toBe(true);
  });

  it("flags an invoice tax amount that doesn't match the summed VAT breakdown amounts", () => {
    const invoice = clone(domesticSimple) as Invoice;
    // will be fail with 190
    invoice.taxAmount = 100;

    const issues = validateBusinessRules(invoice);

    expect(issues.some((i) => i.code === "INVOICE_TAX_AMOUNT_MISMATCH")).toBe(true);
  });

  it("flags a VAT breakdown with no matching vat rating", () => {
    const invoice = clone(domesticSimple) as Invoice;
    // will be fail with 19
    invoice.vatBreakdowns[0]!.rate = 25;

    const issues = validateBusinessRules(invoice);

    expect(issues.some((i) => i.code === "VAT_BREAKDOWN_RATE_MISMATCH")).toBe(true);
  });

  it("flags a monetary amount with more than 2 decimal places", () => {
    const invoice = clone(domesticSimple) as Invoice;
    // will be fail with xxxx.xx, xxxx.x, xxxx, xxx, xx, x
    invoice.lines[0]!.lineAmount = 1000.001;

    const issues = validateBusinessRules(invoice);

    expect(issues.some((i) => i.code === "MONETARY_AMOUNT_DECIMAL_PRECISION")).toBe(true);
  });

  it("flags the correct line when line 2 amount doesn't match quantity x unit price", () => {
    const invoice = clone(domesticMultiLine) as Invoice;
    // will be fail with 190
    invoice.lines[1]!.lineAmount = 19;

    const issues = validateBusinessRules(invoice);

    expect(issues.some((i) => i.code === "LINE_AMOUNT_ROUNDING")).toBe(true);
  });

  it("flags VAT_TAXABLE_AMOUNT_MISMATCH across a multi-line invoice", () => {
    const invoice = clone(domesticMultiLine) as Invoice;
    // fail with 1239
    invoice.vatBreakdowns[0]!.taxableAmount = 123;

    const issues = validateBusinessRules(invoice);

    expect(issues.some((i) => i.code === "VAT_TAXABLE_AMOUNT_MISMATCH")).toBe(true);
  });

  it("flags a category 'S' line at 7% with a zero VAT rate", () => {
    const invoice = clone(reducedRate) as Invoice;
    // fail if number >0
    invoice.lines[0]!.vatRate = 0;

    const issues = validateBusinessRules(invoice);

    expect(issues.some((i) => i.code === "VAT_RATE_INVALID_FOR_CATEGORY")).toBe(true);
  });

  it("flags a category 'S' line at a rate outside 19%/7%", () => {
    const invoice = clone(domesticSimple) as Invoice;
    // only 19 or 7 are valid; 15 must fail
    invoice.lines[0]!.vatRate = 15;

    const issues = validateBusinessRules(invoice);

    expect(issues.some((i) => i.code === "VAT_RATE_INVALID_FOR_CATEGORY")).toBe(true);
  });

  it("flags VAT_TAX_AMOUNT_ROUNDING on a 7% reduced-rate breakdown", () => {
    const invoice = clone(reducedRate) as Invoice;
    //fail 17.5
    invoice.vatBreakdowns[0]!.taxAmount = 17.4;

    const issues = validateBusinessRules(invoice);

    expect(issues.some((i) => i.code === "VAT_TAX_AMOUNT_ROUNDING")).toBe(true);
  });

  it("flags a category 'Z' line with a positive VAT rate", () => {
    const invoice = clone(zeroRated) as Invoice;
    // fail with 0
    invoice.lines[0]!.vatRate = 1;

    const issues = validateBusinessRules(invoice);

    expect(issues.some((i) => i.code === "VAT_RATE_INVALID_FOR_CATEGORY")).toBe(true);
  });

  it("flags VAT_TAX_AMOUNT_ROUNDING when a zero-rated breakdown has non-zero taxAmount", () => {
    const invoice = clone(zeroRated) as Invoice;
    // fail with 0
    invoice.vatBreakdowns[0]!.taxAmount = 1;

    const issues = validateBusinessRules(invoice);

    expect(issues.some((i) => i.code === "VAT_TAX_AMOUNT_ROUNDING")).toBe(true);
  });
});
