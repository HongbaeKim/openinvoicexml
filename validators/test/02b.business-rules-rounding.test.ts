import { describe, expect, it } from "vitest";

import { validateBusinessRules } from "../engines/02.business-rules.js";
import { generateInvoiceXml } from "../../adapters/browser.js";
import { toCii } from "../../adapters/cii.js";
import { validateXmlExternally } from "../../adapters/external-validation.js";
import { calculateLineNetAmount, calculateVatAmount } from "../../core/amounts.js";
import type { Invoice } from "../../core/types/invoice.js";
import {
  creditNoteHalfCent,
  domesticSimple,
  halfCentLineAmounts,
  halfCentVatAmount,
} from "../../fixtures/index.js";
import { requireValidators } from "./validator-availability.test-helpers.js";

/**
 * Exact decimal rounding in the amount checks (core/utils/decimal.ts):
 * - BT-131: round(quantity × unit price) on its own (Peppol BIS 3.0 / R120), then + charges − allowances,
 *   compared with a 1-cent tolerance (the engine's existing project tolerance);
 * - BT-117: round(taxable × rate) half away from zero, 1-cent tolerance;
 * - document totals (BR-CO-13 to BR-CO-16): exact.
 */

const AMOUNT_CODES = new Set([
  "LINE_AMOUNT_ROUNDING",
  "VAT_TAXABLE_AMOUNT_MISMATCH",
  "VAT_TAX_AMOUNT_ROUNDING",
  "INVOICE_TAX_EXCLUSIVE_AMOUNT_MISMATCH",
  "INVOICE_TAX_AMOUNT_MISMATCH",
  "INVOICE_TAX_INCLUSIVE_AMOUNT_MISMATCH",
  "INVOICE_DUE_PAYABLE_AMOUNT_MISMATCH",
  "MONETARY_AMOUNT_DECIMAL_PRECISION",
]);

interface LineSpec {
  quantity: number;
  unitPrice: number;
  lineAmount: number;
  allowancesCharges?: { amount: number; isCharge: boolean; reason: string }[];
}

/** domestic-simple with the given lines at 19 % and the given (stated) totals. */
function invoice(
  lines: LineSpec[],
  totals: { taxable: number; tax: number; inclusive: number; due?: number; exclusive?: number },
): Invoice {
  const base = JSON.parse(JSON.stringify(domesticSimple)) as Invoice;
  return {
    ...base,
    lines: lines.map((l, i) => ({
      ...base.lines[0]!,
      id: String(i + 1),
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineAmount: l.lineAmount,
      ...(l.allowancesCharges ? { allowancesCharges: l.allowancesCharges } : {}),
    })),
    vatBreakdowns: [
      { categoryCode: "S", rate: 19, taxableAmount: totals.taxable, taxAmount: totals.tax },
    ],
    taxExclusiveAmount: totals.exclusive ?? totals.taxable,
    taxAmount: totals.tax,
    taxInclusiveAmount: totals.inclusive,
    duePayableAmount: totals.due ?? totals.inclusive,
  };
}

const amountIssues = (inv: Invoice): string[] =>
  validateBusinessRules(inv)
    .filter((i) => AMOUNT_CODES.has(i.code))
    .map((i) => i.code);

const SMALL = [
  { quantity: 1000, unitPrice: 0.0055, lineAmount: 5.5 },
  { quantity: 30, unitPrice: 0.0055, lineAmount: 0.17 },
  { quantity: 3, unitPrice: 0.0055, lineAmount: 0.02 },
];

describe("exact decimal rounding in amount checks", () => {
  it("accepts the correctly rounded half cent (30 × 0.0055 = 0.165 → 0.17) — a false LINE_AMOUNT_ROUNDING before", () => {
    expect(amountIssues(invoice(SMALL, { taxable: 5.69, tax: 1.08, inclusive: 6.77 }))).toEqual([]);
  });

  it("still accepts invoices already issued with the old float result 0.16 (within the 1-cent line tolerance)", () => {
    const lines = SMALL.map((l) => (l.quantity === 30 ? { ...l, lineAmount: 0.16 } : l));
    expect(amountIssues(invoice(lines, { taxable: 5.68, tax: 1.08, inclusive: 6.76 }))).toEqual([]);
  });

  it("rejects a line amount 2 cents off", () => {
    const lines = SMALL.map((l) => (l.quantity === 30 ? { ...l, lineAmount: 0.15 } : l));
    expect(amountIssues(invoice(lines, { taxable: 5.67, tax: 1.08, inclusive: 6.75 }))).toContain(
      "LINE_AMOUNT_ROUNDING",
    );
  });

  it("rounds negative credit-note lines symmetrically (-30 × 0.0055 = -0.165 → -0.17)", () => {
    const ok = invoice([{ quantity: -30, unitPrice: 0.0055, lineAmount: -0.17 }], {
      taxable: -0.17,
      tax: -0.03,
      inclusive: -0.2,
    });
    expect(amountIssues(ok)).toEqual([]);
    const off = invoice([{ quantity: -30, unitPrice: 0.0055, lineAmount: -0.15 }], {
      taxable: -0.15,
      tax: -0.03,
      inclusive: -0.18,
    });
    expect(amountIssues(off)).toContain("LINE_AMOUNT_ROUNDING");
  });

  it("rounds quantity × price before line allowances (Peppol R120): 1 × 0.005 − 1.00 = -0.99", () => {
    const allowance = [{ amount: 1, isCharge: false, reason: "Rabatt" }];
    const exact = invoice(
      [{ quantity: 1, unitPrice: 0.005, lineAmount: -0.99, allowancesCharges: allowance }],
      { taxable: -0.99, tax: -0.19, inclusive: -1.18 },
    );
    expect(amountIssues(exact)).toEqual([]);
    const far = invoice(
      [{ quantity: 1, unitPrice: 0.005, lineAmount: -1.02, allowancesCharges: allowance }],
      { taxable: -1.02, tax: -0.19, inclusive: -1.21 },
    );
    expect(amountIssues(far)).toContain("LINE_AMOUNT_ROUNDING");
  });

  it("rounds VAT halves away from zero: 0.50 × 19 % = 0.095 → 0.10, and -0.095 → -0.10", () => {
    expect(
      amountIssues(
        invoice([{ quantity: 1, unitPrice: 0.5, lineAmount: 0.5 }], {
          taxable: 0.5,
          tax: 0.1,
          inclusive: 0.6,
        }),
      ),
    ).toEqual([]);
    expect(
      amountIssues(
        invoice([{ quantity: -1, unitPrice: 0.5, lineAmount: -0.5 }], {
          taxable: -0.5,
          tax: -0.1,
          inclusive: -0.6,
        }),
      ),
    ).toEqual([]);
    expect(
      amountIssues(
        invoice([{ quantity: 1, unitPrice: 0.5, lineAmount: 0.5 }], {
          taxable: 0.5,
          tax: 0.08,
          inclusive: 0.58,
        }),
      ),
    ).toContain("VAT_TAX_AMOUNT_ROUNDING");
  });

  it("requires exact document totals (BR-CO-13 to BR-CO-16): one cent off is now reported", () => {
    const good = { taxable: 5.69, tax: 1.08, inclusive: 6.77 };
    expect(amountIssues(invoice(SMALL, { ...good, inclusive: 6.78, due: 6.78 }))).toContain(
      "INVOICE_TAX_INCLUSIVE_AMOUNT_MISMATCH",
    );
    expect(amountIssues(invoice(SMALL, { ...good, due: 6.76 }))).toContain(
      "INVOICE_DUE_PAYABLE_AMOUNT_MISMATCH",
    );
    expect(amountIssues(invoice(SMALL, { ...good, exclusive: 5.7, inclusive: 6.78 }))).toContain(
      "INVOICE_TAX_EXCLUSIVE_AMOUNT_MISMATCH",
    );
  });

  it("ignores binary noise in stated amounts (0.1 + 0.2)", () => {
    const lines = [
      { quantity: 1, unitPrice: 0.1, lineAmount: 0.1 },
      { quantity: 1, unitPrice: 0.2, lineAmount: 0.2 },
    ];
    expect(
      amountIssues(invoice(lines, { taxable: 0.1 + 0.2, tax: 0.06, inclusive: 0.1 + 0.2 + 0.06 })),
    ).toEqual([]);
  });

  it("handles very large values exactly (1 000 000 × 9 999.9999 = 9 999 999 900.00)", () => {
    expect(
      amountIssues(
        invoice([{ quantity: 1_000_000, unitPrice: 9999.9999, lineAmount: 9_999_999_900 }], {
          taxable: 9_999_999_900,
          tax: 1_899_999_981,
          inclusive: 11_899_999_881,
        }),
      ),
    ).toEqual([]);
  });

  it("handles exponent-notation numbers (1e7 × 1e-7 = 1.00)", () => {
    expect(
      amountIssues(
        invoice([{ quantity: 1e7, unitPrice: 1e-7, lineAmount: 1 }], {
          taxable: 1,
          tax: 0.19,
          inclusive: 1.19,
        }),
      ),
    ).toEqual([]);
  });

  it("reports a non-finite line amount instead of crashing", () => {
    expect(
      amountIssues(
        invoice([{ quantity: 1, unitPrice: 1, lineAmount: Number.NaN }], {
          taxable: 1,
          tax: 0.19,
          inclusive: 1.19,
        }),
      ),
    ).toContain("LINE_AMOUNT_ROUNDING");
  });
});

/**
 * Fixtures 61–63 (half cents end to end). `validateBusinessRules` keeps a 1-cent tolerance for line amounts and for
 * category 'S' VAT, so a VAT amount computed the old float way (14.50 × 7 % → 1.01) would still pass it. The public
 * helpers must therefore reproduce every stated amount exactly; v0.5.0's `Math.round(v * 100) / 100` gives 0.16, 3.01,
 * 0.05 and 1.01 here.
 */
describe("fixtures 61–63: the public helpers reproduce every stated line and VAT amount exactly", () => {
  it.each([
    ["61", halfCentLineAmounts],
    ["62", halfCentVatAmount],
    ["63", creditNoteHalfCent],
  ])("fixture %s", (_label, fixture) => {
    const inv = fixture as Invoice;
    for (const line of inv.lines) {
      expect(calculateLineNetAmount(line.quantity, line.unitPrice)).toBe(line.lineAmount);
    }
    for (const b of inv.vatBreakdowns) {
      expect(calculateVatAmount(b.taxableAmount, b.rate)).toBe(b.taxAmount);
    }
    expect(amountIssues(inv)).toEqual([]);
  });

  it("the half cents in the fixtures: 0.17, 3.02, 0.06 and VAT 1.02 (not 0.16, 3.01, 0.05, 1.01)", () => {
    expect(calculateLineNetAmount(30, 0.0055)).toBe(0.17);
    expect(calculateLineNetAmount(3, 1.005)).toBe(3.02);
    expect(calculateLineNetAmount(10, 0.0055)).toBe(0.06);
    expect(calculateVatAmount(14.5, 7)).toBe(1.02);
  });
});

/**
 * Negative half cents, kept apart from credit-note sign conventions: an ordinary invoice (380) with a positive total
 * that nets returned goods off as negative lines. Half away from zero: −0.165 → −0.17, −3.015 → −3.02,
 * −0.055 → −0.06, and a negative 7 % category −14.50 × 7 % = −1.015 → −1.02. v0.5.0 rejected this invoice with
 * LINE_AMOUNT_ROUNDING and withheld the XML.
 */
function negativeLinesInvoice(): Invoice {
  const base = JSON.parse(JSON.stringify(domesticSimple)) as Invoice;
  const line = (
    id: string,
    quantity: number,
    unitPrice: number,
    lineAmount: number,
    vatRate: number,
  ): Invoice["lines"][number] => ({
    ...base.lines[0]!,
    id,
    name: Number(id) === 1 ? "Wartungspauschale" : `Rückgabe Position ${id}`,
    quantity,
    unitCode: "C62",
    unitPrice,
    lineAmount,
    vatRate,
  });
  return {
    ...base,
    lines: [
      line("1", 1, 100, 100, 19),
      line("2", -30, 0.0055, -0.17, 19),
      line("3", -3, 1.005, -3.02, 19),
      line("4", -10, 0.0055, -0.06, 19),
      line("5", -1, 14.5, -14.5, 7),
    ],
    vatBreakdowns: [
      { categoryCode: "S", rate: 19, taxableAmount: 96.75, taxAmount: 18.38 },
      { categoryCode: "S", rate: 7, taxableAmount: -14.5, taxAmount: -1.02 },
    ],
    taxExclusiveAmount: 82.25,
    taxAmount: 17.36,
    taxInclusiveAmount: 99.61,
    duePayableAmount: 99.61,
  };
}

describe("negative half cents on an invoice (380), separate from credit notes", () => {
  it("rounds negative lines and a negative VAT category half away from zero", () => {
    expect(calculateLineNetAmount(-30, 0.0055)).toBe(-0.17);
    expect(calculateLineNetAmount(-3, 1.005)).toBe(-3.02);
    expect(calculateLineNetAmount(-10, 0.0055)).toBe(-0.06);
    expect(calculateVatAmount(-14.5, 7)).toBe(-1.02);
    expect(amountIssues(negativeLinesInvoice())).toEqual([]);
  });

  it("writes the exact negative amounts to UBL", () => {
    const { xml, issues } = generateInvoiceXml(negativeLinesInvoice());
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    for (const amount of ["-0.17", "-3.02", "-0.06", "-14.50"]) {
      expect(xml).toContain(
        `<cbc:LineExtensionAmount currencyID="EUR">${amount}</cbc:LineExtensionAmount>`,
      );
    }
    expect(xml).toContain('<cbc:TaxableAmount currencyID="EUR">-14.50</cbc:TaxableAmount>');
    expect(xml).toContain('<cbc:TaxAmount currencyID="EUR">-1.02</cbc:TaxAmount>');
    expect(xml).toContain('<cbc:TaxAmount currencyID="EUR">18.38</cbc:TaxAmount>');
    expect(xml).toContain('<cbc:TaxAmount currencyID="EUR">17.36</cbc:TaxAmount>');
    expect(xml).toContain('<cbc:PayableAmount currencyID="EUR">99.61</cbc:PayableAmount>');
  });

  it("writes the exact negative amounts to CII", () => {
    const cii = toCii(negativeLinesInvoice(), { profile: "XRECHNUNG" });
    for (const amount of ["-0.17", "-3.02", "-0.06", "-14.50"]) {
      expect(cii).toContain(`<ram:LineTotalAmount>${amount}</ram:LineTotalAmount>`);
    }
    expect(cii).toContain("<ram:CalculatedAmount>-1.02</ram:CalculatedAmount>");
    expect(cii).toContain("<ram:BasisAmount>-14.50</ram:BasisAmount>");
    expect(cii).toContain('<ram:TaxTotalAmount currencyID="EUR">17.36</ram:TaxTotalAmount>');
    expect(cii).toContain("<ram:DuePayableAmount>99.61</ram:DuePayableAmount>");
  });

  const validatorsAvailable = requireValidators(["KoSIT", "Mustang"]);

  it.skipIf(!validatorsAvailable).each([
    ["UBL", (): string => generateInvoiceXml(negativeLinesInvoice()).xml!],
    ["CII", (): string => toCii(negativeLinesInvoice(), { profile: "XRECHNUNG" })],
  ])(
    "KoSIT and Mustang accept the %s output with zero errors",
    (_format, build) => {
      const result = validateXmlExternally(build());
      expect(result.kosit.ran).toBe(true);
      expect(result.mustang.ran).toBe(true);
      expect(result.complianceIssues.filter((i) => i.severity === "error")).toEqual([]);
    },
    120_000,
  );
});
