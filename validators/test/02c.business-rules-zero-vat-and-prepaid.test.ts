import { describe, expect, it } from "vitest";

import { validateBusinessRules } from "../engines/02.business-rules.js";
import { generateInvoiceXml } from "../../adapters/browser.js";
import { runKositAgainstXml } from "../../adapters/external-validation.js";
import type { Invoice } from "../../core/types/invoice.js";
import type { ValidationIssue } from "../types.js";
import {
  domesticSimple,
  exempt,
  exportInvoice,
  finalInvoice,
  intraEuSupply,
  mixedCategoryVat,
  outsideScopeDamages,
  reverseCharge,
  zeroRated,
} from "../../fixtures/index.js";
import { requireValidators } from "./validator-availability.test-helpers.js";

/**
 * - Zero-VAT categories Z, E, AE, K, G, O: the VAT breakdown's taxable amount (BT-116) must equal the sum of its
 *   lines and document allowances/charges exactly (BR-Z/E/AE/IC/G/O-08), and its VAT amount (BT-117) must be
 *   exactly 0 (BR-Z/E/AE/IC/G/O-09). Before, the general 1-cent tolerance let 0.01 through.
 *   Category 'S' keeps the 1-cent tolerance (BR-S-08/BR-S-09 allow ±1).
 * - BR-DEC-16: the paid amount (BT-113, prepaidAmount) has at most 2 decimals. Before, 7140.005 was written as
 *   7140.01 without a report.
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

/**
 * Creates a separate copy of a test invoice.
 * This prevents one test from changing the original fixture
 * and affecting another test.
 */
const clone = (fixture: unknown): Invoice => JSON.parse(JSON.stringify(fixture)) as Invoice;

/** Returns only monetary validation issues. */
const amountIssues = (inv: Invoice): ValidationIssue[] =>
  validateBusinessRules(inv).filter((i) => AMOUNT_CODES.has(i.code));
/** Returns only monetary error codes. */
const amountCodes = (inv: Invoice): string[] => amountIssues(inv).map((i) => i.code);

/**
 * Changes the VAT amount of one VAT breakdown for testing.
 *
 * Example:
 * Original VAT = 19.00
 * delta = 0.01
 * New VAT = 19.01
 *
 * Also updates the related invoice totals so the test
 * can focus on the VAT breakdown instead of inconsistent totals.
 *
 * Note: Math.round() is used here to prepare test values,
 * not as the production invoice rounding implementation.
 */
function withBreakdownTax(fixture: unknown, index: number, delta: number): Invoice {
  const inv = clone(fixture);
  const vb = inv.vatBreakdowns[index]!;
  vb.taxAmount = Math.round((vb.taxAmount + delta) * 100) / 100;
  inv.taxAmount = Math.round((inv.taxAmount + delta) * 100) / 100;
  inv.taxInclusiveAmount = Math.round((inv.taxInclusiveAmount + delta) * 100) / 100;
  inv.duePayableAmount = Math.round((inv.duePayableAmount + delta) * 100) / 100;
  return inv;
}

/**
 * Changes only the taxable amount in one VAT breakdown.
 *
 * Example:
 * Correct taxable amount = 100.00
 * delta = 0.01
 * Test taxable amount = 100.01
 *
 * The invoice lines and other totals stay unchanged.
 * This lets us check whether validation catches the mismatch.
 */
function withBreakdownTaxable(fixture: unknown, index: number, delta: number): Invoice {
  const inv = clone(fixture);
  const vb = inv.vatBreakdowns[index]!;
  vb.taxableAmount = Math.round((vb.taxableAmount + delta) * 100) / 100;
  return inv;
}

const ZERO_VAT_FIXTURES: [category: string, rule: string, fixture: unknown][] = [
  ["Z", "BR-Z", zeroRated],
  ["E", "BR-E", exempt],
  ["AE", "BR-AE", reverseCharge],
  ["K", "BR-IC", intraEuSupply],
  ["G", "BR-G", exportInvoice],
  ["O", "BR-O", outsideScopeDamages],
];

describe("zero-VAT categories: exact taxable amount (BR-x-08) and VAT amount exactly 0 (BR-x-09)", () => {
  it.each(ZERO_VAT_FIXTURES)(
    "category %s fixture is valid as it is",
    (category, _rule, fixture) => {
      const inv = clone(fixture);
      expect(inv.vatBreakdowns.map((vb) => vb.categoryCode)).toEqual([category]);
      expect(amountCodes(inv)).toEqual([]); // no monetary issues
    },
  );

  it.each(ZERO_VAT_FIXTURES)(
    "category %s: a VAT amount of 0.01 is rejected (%s-09)",
    (category, rule, fixture) => {
      const issues = amountIssues(withBreakdownTax(fixture, 0, 0.01)); // add 1 cent to the VAT amount
      expect(issues.map((i) => i.code)).toEqual(["VAT_TAX_AMOUNT_ROUNDING"]); // the only monetary issue is the VAT amount
      expect(issues[0]!.path).toBe("vatBreakdowns[0].taxAmount");
      expect(issues[0]!.message).toContain(
        `must be exactly 0 for VAT category '${category}' (${rule}-09)`,
      );
    },
  );

  it.each(ZERO_VAT_FIXTURES)(
    "category %s: a VAT amount of -0.01 is rejected too",
    (_category, _rule, fixture) => {
      expect(amountCodes(withBreakdownTax(fixture, 0, -0.01))).toEqual(["VAT_TAX_AMOUNT_ROUNDING"]); // the only monetary issue is the VAT amount
    },
  );

  it.each(ZERO_VAT_FIXTURES)(
    "category %s: a taxable amount 1 cent off is rejected (%s-08)",
    (_category, rule, fixture) => {
      for (const delta of [0.01, -0.01]) {
        const issues = amountIssues(withBreakdownTaxable(fixture, 0, delta));
        expect(issues.map((i) => i.code)).toEqual(["VAT_TAXABLE_AMOUNT_MISMATCH"]); // the only monetary issue is the taxable amount
        expect(issues[0]!.message).toContain(`(${rule}-08: must match exactly)`);
      }
    },
  );

  it("a zero-VAT breakdown with a wrongly stated non-zero rate still needs a VAT amount of 0 (BR-Z-09)", () => {
    const inv = clone(zeroRated);
    inv.vatBreakdowns[0]!.rate = 7;
    inv.lines.forEach((line) => (line.vatRate = 7));
    const issues = validateBusinessRules(inv);
    expect(issues.some((i) => i.code === "VAT_RATE_INVALID_FOR_CATEGORY")).toBe(true); // the rate is wrong for category Z
    expect(issues.some((i) => i.code === "VAT_TAX_AMOUNT_ROUNDING")).toBe(false); // 0.00 is what BR-Z-09 wants
  });
});

describe("category 'S' keeps the 1-cent tolerance (BR-S-08 / BR-S-09 allow ±1)", () => {
  it("S breakdown: VAT amount 1 cent off is accepted, 2 cents off is rejected", () => {
    expect(amountCodes(withBreakdownTax(domesticSimple, 0, 0.01))).toEqual([]); // accepted
    expect(amountCodes(withBreakdownTax(domesticSimple, 0, 0.02))).toEqual([
      "VAT_TAX_AMOUNT_ROUNDING",
    ]); // rejected
  });

  it("S breakdown: taxable amount 1 cent off is accepted, 2 cents off is rejected", () => {
    expect(amountCodes(withBreakdownTaxable(domesticSimple, 0, 0.01))).toEqual([]); // accepted
    expect(amountCodes(withBreakdownTaxable(domesticSimple, 0, 0.02))).toEqual([
      "VAT_TAXABLE_AMOUNT_MISMATCH",
    ]); // rejected
  });

  it("mixed S + Z invoice: 1 cent on S is accepted, 1 cent on Z is rejected", () => {
    const inv = clone(mixedCategoryVat);
    expect(inv.vatBreakdowns.map((vb) => vb.categoryCode)).toEqual(["S", "Z"]);
    expect(amountCodes(inv)).toEqual([]);
    expect(amountCodes(withBreakdownTax(mixedCategoryVat, 0, 0.01))).toEqual([]);
    const zIssues = amountIssues(withBreakdownTax(mixedCategoryVat, 1, 0.01));
    expect(zIssues.map((i) => [i.code, i.path])).toEqual([
      ["VAT_TAX_AMOUNT_ROUNDING", "vatBreakdowns[1].taxAmount"],
    ]); // the Z breakdown is rejected
    expect(
      amountIssues(withBreakdownTaxable(mixedCategoryVat, 1, 0.01)).map((i) => i.path),
    ).toEqual(["vatBreakdowns[1].taxableAmount"]); // the Z breakdown is rejected, S is accepted
  });
});

describe("BR-DEC-16: prepaidAmount (BT-113) has at most 2 decimals", () => {
  const withPrepaid = (prepaid: number, due: number): Invoice => {
    const inv = clone(finalInvoice);
    inv.prepaidAmount = prepaid;
    inv.duePayableAmount = due;
    return inv;
  };

  it("the final-invoice fixture (prepaid 7140.00) is valid and its XML keeps 7140.00", () => {
    const inv = clone(finalInvoice);
    expect(inv.prepaidAmount).toBe(7140);
    expect(amountCodes(inv)).toEqual([]);
    const { xml } = generateInvoiceXml(inv);
    expect(xml).toContain('<cbc:PrepaidAmount currencyID="EUR">7140.00</cbc:PrepaidAmount>'); // the XML keeps 2 decimals
  });

  it.each([
    [7140.5, 16659.5],
    [0.01, 23799.99],
    [0.1 + 0.2, 23799.7], // binary noise, not a third decimal
  ])("accepts prepaidAmount %d", (prepaid, due) => {
    expect(amountCodes(withPrepaid(prepaid, due))).toEqual([]); // no monetary issues
  });

  it.each([
    [7140.005, 16659.99],
    [7140.001, 16660],
    [0.001, 23800],
  ])(
    "rejects prepaidAmount %d instead of rounding it silently, and generates no XML",
    (prepaid, due) => {
      const inv = withPrepaid(prepaid, due);
      const issues = amountIssues(inv);
      expect(issues.map((i) => [i.code, i.path])).toContainEqual([
        "MONETARY_AMOUNT_DECIMAL_PRECISION",
        "prepaidAmount",
      ]); // the only monetary issue is the prepaidAmount
      expect(generateInvoiceXml(inv).xml).toBeNull(); // no XML is generated for an invalid invoice
    },
  );

  it("no prepaidAmount, no check", () => {
    const inv = clone(domesticSimple);
    expect(inv.prepaidAmount).toBeUndefined();
    expect(amountIssues(inv).some((i) => i.path === "prepaidAmount")).toBe(false); // no monetary issue for prepaidAmount
  });
});

/**
 * Evidence from the official validator: the same changes, made directly in valid XML, are rejected by KoSIT
 * (XRechnung 3.0.2, EN 16931 Schematron) with the rule IDs above, and a 1-cent difference on 'S' is not a BR-S-09
 * finding. Skipped when Java / KoSIT are not available (see validator-availability.test-helpers.ts).
 */
const kositAvailable = requireValidators(["KoSIT"]);

describe.skipIf(!kositAvailable)("KoSIT agrees on the rule IDs", () => {
  const ruleIds = (xml: string): string[] =>
    runKositAgainstXml(xml)
      .filter((i) => i.severity === "error")
      .map((i) => /\[([A-Z0-9-]+)\]/.exec(i.message)?.[1] ?? i.message);

  const validXml = (fixture: unknown): string => {
    const { xml, issues } = generateInvoiceXml(clone(fixture));
    expect(issues.filter((i) => i.severity === "error")).toEqual([]); // no errors in the generated XML
    return xml!;
  };

  it("zero-rated: BT-117 = 0.01 → BR-Z-09; BT-116 1 cent off → BR-Z-08", () => {
    const xml = validXml(zeroRated);
    const subtotalTax =
      /(<cac:TaxSubtotal>[\s\S]*?<cbc:TaxAmount currencyID="EUR">)0\.00(<\/cbc:TaxAmount>)/;
    const subtotalTaxable =
      /(<cac:TaxSubtotal>[\s\S]*?<cbc:TaxableAmount currencyID="EUR">)1000\.00(<\/cbc:TaxableAmount>)/;
    expect(xml).toMatch(subtotalTax);
    expect(xml).toMatch(subtotalTaxable);
    expect(ruleIds(xml.replace(subtotalTax, "$10.01$2"))).toContain("BR-Z-09");
    expect(ruleIds(xml.replace(subtotalTaxable, "$11000.01$2"))).toContain("BR-Z-08");
  }, 120_000);

  it("final invoice: PrepaidAmount 7140.005 → BR-DEC-16", () => {
    const xml = validXml(finalInvoice);
    const prepaid = '<cbc:PrepaidAmount currencyID="EUR">7140.00</cbc:PrepaidAmount>';
    expect(xml).toContain(prepaid);
    expect(
      ruleIds(
        xml.replace(prepaid, '<cbc:PrepaidAmount currencyID="EUR">7140.005</cbc:PrepaidAmount>'),
      ),
    ).toContain("BR-DEC-16");
  }, 120_000);

  it("standard rate: BT-117 1 cent off is not a BR-S-09 / BR-CO-17 finding (so the 1-cent tolerance stays)", () => {
    const xml = validXml(domesticSimple);
    const subtotalTax =
      /(<cac:TaxSubtotal>[\s\S]*?<cbc:TaxAmount currencyID="EUR">)(\d+)\.(\d\d)(<\/cbc:TaxAmount>)/;
    const m = subtotalTax.exec(xml);
    expect(m).not.toBeNull();
    const cents = BigInt(m![2]!) * 100n + BigInt(m![3]!) + 1n;
    const plusOne = `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
    const ids = ruleIds(xml.replace(subtotalTax, `$1${plusOne}$4`));
    expect(ids).not.toContain("BR-S-09");
    expect(ids).not.toContain("BR-CO-17");
  }, 120_000);
});
