import { describe, expect, it } from "vitest";

import {
  calculateLineNetAmount,
  calculateVatAmount,
  generateInvoiceXml,
  sumAmounts,
  toXRechnung,
} from "../browser.js";
import type { Invoice } from "../../core/index.js";
import { documentLevelDiscount, domesticSimple, lineLevelDiscount } from "../../fixtures/index.js";

/**
 * Invalid amounts must never become valid-looking XML: generateInvoiceXml (validated) returns xml: null, the
 * low-level toXRechnung (not validated) writes a visible "NaN"/"Infinity", and the public amount helpers keep NaN.
 */
const clone = (inv: unknown): Invoice => JSON.parse(JSON.stringify(inv)) as Invoice;

type Mutation = [string, (inv: Invoice) => void];
const BAD: number[] = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

const mutations = (bad: number): Mutation[] => [
  ["lines[0].quantity", (inv): void => void (inv.lines[0]!.quantity = bad)],
  ["lines[0].unitPrice", (inv): void => void (inv.lines[0]!.unitPrice = bad)],
  ["lines[0].lineAmount", (inv): void => void (inv.lines[0]!.lineAmount = bad)],
  ["lines[0].vatRate", (inv): void => void (inv.lines[0]!.vatRate = bad)],
  [
    "vatBreakdowns[0].taxableAmount",
    (inv): void => void (inv.vatBreakdowns[0]!.taxableAmount = bad),
  ],
  ["vatBreakdowns[0].taxAmount", (inv): void => void (inv.vatBreakdowns[0]!.taxAmount = bad)],
  ["vatBreakdowns[0].rate", (inv): void => void (inv.vatBreakdowns[0]!.rate = bad)],
  ["taxExclusiveAmount", (inv): void => void (inv.taxExclusiveAmount = bad)],
  ["taxAmount", (inv): void => void (inv.taxAmount = bad)],
  ["taxInclusiveAmount", (inv): void => void (inv.taxInclusiveAmount = bad)],
  ["duePayableAmount", (inv): void => void (inv.duePayableAmount = bad)],
  ["prepaidAmount", (inv): void => void (inv.prepaidAmount = bad)],
  ["roundingAmount", (inv): void => void (inv.roundingAmount = bad)],
];

describe("generateInvoiceXml never returns XML for a non-finite amount", () => {
  for (const bad of BAD) {
    it.each(mutations(bad).map(([field, mutate]) => [field, mutate] as const))(
      `%s = ${bad}`,
      (_field, mutate) => {
        const invoice = clone(domesticSimple);
        mutate(invoice);
        const result = generateInvoiceXml(invoice);
        expect(result.xml).toBeNull();
        expect(result.issues.some((i) => i.severity === "error")).toBe(true); // at least one error is reported
      },
    );
  }

  it.each(BAD)("line allowance amount = %s", (bad) => {
    const invoice = clone(lineLevelDiscount);
    invoice.lines.find((l) => l.allowancesCharges?.length)!.allowancesCharges![0]!.amount = bad;
    expect(generateInvoiceXml(invoice).xml).toBeNull(); // the allowance is rejected, the invoice is invalid
  });

  it.each(BAD)("document allowance amount = %s", (bad) => {
    const invoice = clone(documentLevelDiscount);
    invoice.allowancesCharges![0]!.amount = bad;
    expect(generateInvoiceXml(invoice).xml).toBeNull(); // the allowance is rejected, the invoice is invalid
  });
});

describe("allowance/charge amounts with more than 2 decimals are reported, not rounded silently (BR-DEC-01/05/24/27)", () => {
  it("line level", () => {
    const invoice = clone(lineLevelDiscount);
    const ac = invoice.lines.find((l) => l.allowancesCharges?.length)!.allowancesCharges![0]!;
    ac.amount += 0.005;
    const result = generateInvoiceXml(invoice);
    expect(result.xml).toBeNull(); // the allowance is rejected, the invoice is invalid
    expect(result.issues.map((i) => i.code)).toContain("MONETARY_AMOUNT_DECIMAL_PRECISION");
  });

  it("document level", () => {
    const invoice = clone(documentLevelDiscount);
    invoice.allowancesCharges![0]!.amount += 0.005;
    const result = generateInvoiceXml(invoice);
    expect(result.xml).toBeNull(); // the allowance is rejected, the invoice is invalid
    expect(result.issues.map((i) => i.code)).toContain("MONETARY_AMOUNT_DECIMAL_PRECISION");
  });

  it("the unchanged fixtures still generate", () => {
    expect(generateInvoiceXml(clone(lineLevelDiscount)).xml).not.toBeNull();
    expect(generateInvoiceXml(clone(documentLevelDiscount)).xml).not.toBeNull();
  });
});

describe("toXRechnung (low level, not validated) makes a non-finite amount visible", () => {
  it("writes NaN as text, never as a plausible number", () => {
    const invoice = clone(domesticSimple);
    invoice.lines[0]!.lineAmount = Number.NaN;
    const xml = toXRechnung(invoice);
    expect(xml).toMatch(/<cbc:LineExtensionAmount currencyID="EUR">NaN<\/cbc:LineExtensionAmount>/);
  });
});

describe("public amount helpers keep NaN through a whole calculation", () => {
  it("NaN line → NaN sums → NaN VAT → NaN total", () => {
    const line = calculateLineNetAmount(Number.NaN, 1);
    const taxable = sumAmounts([line, 10]);
    const vat = calculateVatAmount(taxable, 19);
    const total = sumAmounts([taxable, vat]);
    expect([line, taxable, vat, total].every(Number.isNaN)).toBe(true);
  });

  it("money inputs with more than 2 decimals give NaN; binary noise is accepted", () => {
    expect(calculateLineNetAmount(2, 95, [{ amount: 0.125, isCharge: false }])).toBeNaN();
    expect(calculateVatAmount(5.695, 19)).toBeNaN();
    expect(sumAmounts([1.005, 1])).toBeNaN();
    expect(sumAmounts([0.1 + 0.2, 0.7])).toBe(1);
    expect(calculateVatAmount(0.1 + 0.2, 19)).toBe(0.06);
  });

  it("quantities, prices and rates may have any number of decimals", () => {
    expect(calculateLineNetAmount(0.333333, 3.0000000001)).toBe(1);
    expect(calculateVatAmount(100, 7.5)).toBe(7.5);
  });
});
