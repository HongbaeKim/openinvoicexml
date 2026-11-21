import type { Invoice } from "../../core/types/invoice.js";
import type { EInvoiceProfile } from "../../core/types/profile.js";
import type { VatCategoryCode } from "../../core/types/vat-breakdown.js";
import type { ValidationIssue } from "../types.js";
import { add, sub, ZERO, type Decimal } from "../../core/utils/decimal.js";
import {
  centsApart,
  lineNetAmount,
  money,
  moneyText,
  netAdjustment,
  sumMoney,
  vatAmount,
} from "../../core/utils/monetary.js";
import { resolvePlaceOfSupply } from "../../core/utils/place-of-supply.js";
import {
  EXEMPTION_REASON_REQUIRED_CATEGORIES,
  ZERO_RATE_CATEGORIES,
  checkDecimalPrecision,
  checkVatRateForCategory,
} from "../rules/17.vat-rate.js";
import { checkSmallBusinessRequirements } from "../rules/16.small-business.js";
import { checkOutsideScopeRequirements } from "../rules/14.outside-scope.js";
import { checkIntraEuSupplyRequirements } from "../rules/13.intra-eu.js";
import { checkDeliveryAddressRequirements } from "../rules/11.delivery.js";
import { checkExportRequirements } from "../rules/12.export.js";
import { checkReverseChargeSubcaseRequirements } from "../rules/15.reverse-charge.js";
import { checkCreditNoteAndCorrectionRequirements } from "../rules/10.credit-note.js";
import { checkAllowanceChargeRequirements } from "../rules/18.allowance-charge.js";
import { checkXRechnungBuyerReferenceRequirement } from "../rules/19.xrechnung-mandatory-fields.js";
import { checkIssueDateNotInFuture } from "../rules/20.issue-date.js";
import { checkSellerIdentifierRequirement } from "../rules/21.seller-identifier.js";

export type { ValidationIssue } from "../types.js";

// Amount checks use exact decimal arithmetic (core/utils/decimal.ts) and compare whole cents; nothing here
// is a float comparison. Tolerances:
//   - LINE_AMOUNT_ROUNDING, and VAT_TAXABLE_AMOUNT_MISMATCH / VAT_TAX_AMOUNT_ROUNDING for category 'S': 1 cent
//     (the engine's existing project tolerance; stricter than PEPPOL-EN16931-R120's 0.02 warning and
//     BR-S-08/BR-S-09's ±1).
//   - VAT_TAXABLE_AMOUNT_MISMATCH / VAT_TAX_AMOUNT_ROUNDING for the zero-VAT categories Z, E, AE, K, G, O: exact.
//     BR-Z-08, BR-E-08, BR-AE-08, BR-IC-08, BR-G-08, BR-O-08 compare the taxable amount with no tolerance, and
//     BR-Z-09, BR-E-09, BR-AE-09, BR-IC-09, BR-G-09, BR-O-09 require the VAT amount to be exactly 0.
//   - Document totals (BR-CO-13 to BR-CO-16): exact, as the EN 16931 Schematron requires.
const LINE_AND_VAT_TOLERANCE_CENTS = 1n;
const ZERO_VAT_TOLERANCE_CENTS = 0n;
const TOTALS_TOLERANCE_CENTS = 0n;

/** EN 16931 rule-ID prefix of each zero-VAT category: 'K' (intra-community supply) is "IC". */
const ZERO_VAT_RULE_PREFIX: Partial<Record<VatCategoryCode, string>> = {
  Z: "BR-Z",
  E: "BR-E",
  AE: "BR-AE",
  K: "BR-IC",
  G: "BR-G",
  O: "BR-O",
};

/**
 * true when `stated` differs from the expected amount by more than `toleranceCents`. A non-finite stated value, or
 * an expected value that cannot be computed because some input is non-finite (NaN / Infinity), counts as a
 * difference, so the check reports it instead of throwing (as the old float comparison with NaN also failed).
 */
function differsBy(stated: number, expected: () => Decimal, toleranceCents: bigint): boolean {
  if (!Number.isFinite(stated)) return true;
  try {
    return centsApart(money(stated), expected()) > toleranceCents;
  } catch {
    return true;
  }
}

/** The expected amount as text for messages, or a note when an input is non-finite. */
function expectedText(expected: () => Decimal): string {
  try {
    return moneyText(expected());
  } catch {
    return "not computable: an input is not a finite number";
  }
}

/**
 * Checks an invoice against EN 16931 / XRechnung business rules that go beyond
 * structural JSON Schema validation: VAT category/rate consistency, §13b reverse-charge
 * requirements, exemption reason requirements, and EN 16931 rounding/amount consistency.
 *
 * Returns an empty array when the invoice is fully compliant.
 *
 * @see ../docs/COMPLIANCE.md for the source, pinned version, and implementation status of
 * every rule enforced here and in `validators/rules/*`.
 *
 * profile defaults to "EN16931"
 * Use "XRECHNUNG" when creating an XRechnung invoice,
 * so XRechnung-only rules like BT-10 buyer reference are also checked.
 *
 * `options.today` ("YYYY-MM-DD", default: the current UTC date) is the reference date for the
 * future-issue-date warning; pass it for deterministic results.
 */
export function validateBusinessRules(
  invoice: Invoice,
  profile: EInvoiceProfile = "EN16931",
  options: { today?: string } = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  checkIssueDateNotInFuture(
    invoice.issueDate,
    options.today ?? new Date().toISOString().slice(0, 10),
    issues,
  );

  // --- Line-level checks -------------------------------------------------
  invoice.lines.forEach((line, index) => {
    const path = `lines[${index}]`;

    checkVatRateForCategory(line.vatCategoryCode, line.vatRate, `${path}.vatRate`, issues);
    // BT-146 = unit price and can have more than 2 decimals.
    // BT-131 = line total (quantity × unit price) and BR-DEC-23 limits it to 2 decimals.
    //
    // Example: 0.0055 € × 1000 = 5.50 €
    // Keep the precise unit price, then round the line total to 2 decimals.
    checkDecimalPrecision(line.lineAmount, `${path}.lineAmount`, issues);

    // BT-131 = quantity × unitPrice, adjusted by this line's own allowances/charges
    // (BG-27/BG-28) — subtract allowances (discounts), add charges (surcharges).
    // Peppol BIS 3.0 / PEPPOL-EN16931-R120: round(quantity × unitPrice) on its own, then + charges − allowances.
    const expectedLineAmount = (): Decimal => lineNetAmount(line.quantity, line.unitPrice, line.allowancesCharges);
    if (differsBy(line.lineAmount, expectedLineAmount, LINE_AND_VAT_TOLERANCE_CENTS)) {
      issues.push({
        code: "LINE_AMOUNT_ROUNDING",
        severity: "error",
        message: `${path}.lineAmount: BT-131 line net amount ${line.lineAmount} does not match quantity × unit price adjusted for line-level allowances/charges (${expectedText(expectedLineAmount)}).`,
        path: `${path}.lineAmount`,
      });
    }
  });

  // --- VAT category requiring buyer VAT ID (§13b UStG reverse charge) ----
  // Validation requirement: EN 16931 BR-AE-02 requires a buyer identifier on invoices with an
  // 'AE' line, but allows either the buyer VAT ID (BT-48) or the buyer legal registration
  // identifier (BT-47).
  // Project decision: we require BT-48 only, which is stricter than BR-AE-02 (documented in
  // docs/DATA-MODEL.md). Also accepting BT-47 would match BR-AE-02 exactly. This check is not a
  // statement that every reverse-charge case legally needs the buyer's VAT ID; that depends on
  // the §13b UStG scenario and the §14 UStG invoice requirements.
  const hasReverseCharge =
    invoice.lines.some((line) => line.vatCategoryCode === "AE") ||
    invoice.vatBreakdowns.some((vb) => vb.categoryCode === "AE");
  if (hasReverseCharge && !invoice.buyer.vatId) {
    issues.push({
      code: "REVERSE_CHARGE_BUYER_VAT_ID_REQUIRED",
      severity: "error",
      message:
        "buyer.vatId: BT-48 buyer VAT identifier is required when VAT category 'AE' (§13b UStG reverse charge) is used.",
      path: "buyer.vatId",
    });
  }

  // --- §13b UStG reverse-charge subcases (VAT category 'AE') --------------
  checkReverseChargeSubcaseRequirements(invoice.vatBreakdowns, issues);

  // --- §19 UStG small business (VAT category 'E') -------
  checkSmallBusinessRequirements(invoice.seller, invoice.vatBreakdowns, issues);

  // --- Outside the scope of VAT (VAT category 'O') ------------------------
  checkOutsideScopeRequirements(invoice.seller, invoice.buyer, invoice.vatBreakdowns, issues);

  // --- Delivery address (BG-15) --------------------------------------------
  checkDeliveryAddressRequirements(invoice.delivery, issues);

  // --- Intra-EU supply (VAT category 'K') ---------------------------------
  checkIntraEuSupplyRequirements(
    invoice.seller,
    invoice.buyer,
    invoice.vatBreakdowns,
    invoice.delivery,
    issues,
  );

  // --- Export outside EU (VAT category 'G') --------------------------------
  checkExportRequirements(invoice.buyer, invoice.vatBreakdowns, issues);

  // --- XRechnung-only mandatory fields (BT-10 buyer reference) --------------
  checkXRechnungBuyerReferenceRequirement(invoice.buyerReference, profile, issues);

  // --- Seller identifier (BR-CO-26: BT-29, BT-30 or BT-31) ------------------------------
  checkSellerIdentifierRequirement(invoice.seller, issues);

  // --- Credit notes (381) and corrective invoices (384) --------------------
  checkCreditNoteAndCorrectionRequirements(invoice, profile, issues);

  // --- Final invoice deducting a down payment (BT-113) must say which invoice paid it --
  // Mirrors the credit-note/corrective-invoice reference-required checks above: a
  // deduction with no pointer to what it deducts is as incomplete as a credit note with
  // no pointer to what it credits.
  if (invoice.prepaidAmount !== undefined && !invoice.precedingInvoiceReference) {
    issues.push({
      code: "PRECEDING_INVOICE_REFERENCE_REQUIRED",
      severity: "error",
      message:
        "precedingInvoiceReference: BT-25/BT-26 reference to the down payment invoice is required when prepaidAmount (BT-113) is set.",
      path: "precedingInvoiceReference",
    });
  }

  // --- Allowances/charges (BG-20/BG-21 document-level, BG-27/BG-28 line-level) --------
  // Reason and, for document-level entries, VAT category/rate requirements — the amount
  // itself is already covered by LINE_AMOUNT_ROUNDING above and VAT_TAXABLE_AMOUNT_MISMATCH
  // below.
  checkAllowanceChargeRequirements(invoice, issues);
  // BR-DEC-01/05 (document level) and BR-DEC-24/27 (line level): allowance/charge amounts have at most 2 decimals.
  // Without this check a 3-decimal amount would be rounded silently by the amount checks and in the XML.
  (invoice.allowancesCharges ?? []).forEach((ac, j) =>
    checkDecimalPrecision(ac.amount, `allowancesCharges[${j}].amount`, issues),
  );
  invoice.lines.forEach((line, i) =>
    (line.allowancesCharges ?? []).forEach((ac, j) =>
      checkDecimalPrecision(ac.amount, `lines[${i}].allowancesCharges[${j}].amount`, issues),
    ),
  );

  // --- VAT breakdown checks -----------------------------------------------
  const breakdownTaxAmounts: number[] = [];

  invoice.vatBreakdowns.forEach((vb, index) => {
    const path = `vatBreakdowns[${index}]`;

    checkVatRateForCategory(vb.categoryCode, vb.rate, `${path}.rate`, issues);

    checkDecimalPrecision(vb.taxableAmount, `${path}.taxableAmount`, issues);
    checkDecimalPrecision(vb.taxAmount, `${path}.taxAmount`, issues);

    // Validation requirement: BR-E-10, BR-AE-10, BR-IC-10, BR-G-10, BR-O-10; 
    // see EXEMPTION_REASON_REQUIRED_CATEGORIES in rules/17.vat-rate.ts.
    if (
      EXEMPTION_REASON_REQUIRED_CATEGORIES.includes(vb.categoryCode) &&
      !vb.exemptionReason &&
      !vb.exemptionReasonCode
    ) {
      issues.push({
        code: "VAT_EXEMPTION_REASON_REQUIRED",
        severity: "error",
        message: `${path}: BT-120/BT-121 exemption reason (text or code) is required for VAT category '${vb.categoryCode}'.`,
        path,
      });
    }

    // BR-Z-10 (and the same for 'S'): a standard-rated or zero-rated breakdown must
    // not carry an exemption reason at all — exemption reasons only apply to
    // categories where the supply is actually exempt/out-of-scope/reverse-charged.
    if ((vb.categoryCode === "S" || vb.categoryCode === "Z") && (vb.exemptionReason || vb.exemptionReasonCode)) {
      issues.push({
        code: "VAT_EXEMPTION_REASON_NOT_ALLOWED",
        severity: "error",
        message: `${path}: BT-120/BT-121 exemption reason (text or code) must not be present for VAT category '${vb.categoryCode}'.`,
        path,
      });
    }

    const linesForCategory = invoice.lines.filter(
      (line) => line.vatCategoryCode === vb.categoryCode && line.vatRate === vb.rate,
    );

    if (linesForCategory.length === 0) {
      issues.push({
        code: "VAT_BREAKDOWN_RATE_MISMATCH",
        severity: "error",
        message: `${path}: VAT breakdown for category '${vb.categoryCode}' at ${vb.rate}% has no matching invoice lines.`,
        path,
      });
    }

    // BT-116 = sum of matching line amounts (already net of line-level allowances/charges),
    // further adjusted by any document-level allowances/charges (BG-20/BG-21) assigned to
    // this same VAT category/rate.
    const docAdjustmentsForCategory = (invoice.allowancesCharges ?? []).filter(
      (ac) => ac.vatCategoryCode === vb.categoryCode && ac.vatRate === vb.rate,
    );
    // Zero-VAT categories: exact taxable amount (BR-<x>-08) and a VAT amount of exactly 0 (BR-<x>-09), whatever
    // rate was stated (a non-zero rate is reported separately by checkVatRateForCategory).
    const zeroVatRule = ZERO_RATE_CATEGORIES.includes(vb.categoryCode)
      ? ZERO_VAT_RULE_PREFIX[vb.categoryCode]
      : undefined;
    const breakdownTolerance =
      zeroVatRule === undefined ? LINE_AND_VAT_TOLERANCE_CENTS : ZERO_VAT_TOLERANCE_CENTS;

    const expectedTaxableAmount = (): Decimal =>
      add(sumMoney(linesForCategory.map((line) => line.lineAmount)), netAdjustment(docAdjustmentsForCategory));
    if (differsBy(vb.taxableAmount, expectedTaxableAmount, breakdownTolerance)) {
      issues.push({
        code: "VAT_TAXABLE_AMOUNT_MISMATCH",
        severity: "error",
        message: `${path}.taxableAmount: BT-116 taxable amount ${vb.taxableAmount} does not match the sum of line amounts (${expectedText(expectedTaxableAmount)}) for category '${vb.categoryCode}' at ${vb.rate}%${zeroVatRule === undefined ? "" : ` (${zeroVatRule}-08: must match exactly)`}.`,
        path: `${path}.taxableAmount`,
      });
    }

    const expectedTaxAmount = (): Decimal =>
      zeroVatRule === undefined ? vatAmount(money(vb.taxableAmount), vb.rate) : ZERO;
    if (differsBy(vb.taxAmount, expectedTaxAmount, breakdownTolerance)) {
      issues.push({
        code: "VAT_TAX_AMOUNT_ROUNDING",
        severity: "error",
        message:
          zeroVatRule === undefined
            ? `${path}.taxAmount: BT-117 VAT amount ${vb.taxAmount} does not match taxable amount × rate (${expectedText(expectedTaxAmount)}).`
            : `${path}.taxAmount: BT-117 VAT amount ${vb.taxAmount} must be exactly 0 for VAT category '${vb.categoryCode}' (${zeroVatRule}-09).`,
        path: `${path}.taxAmount`,
      });
    }

    breakdownTaxAmounts.push(vb.taxAmount);
  });

  // BR-CO-10/11/12/13: BT-109 = Σ BT-131 − Σ document allowances + Σ document charges (exact).
  const expectedTaxExclusiveAmount = (): Decimal =>
    add(sumMoney(invoice.lines.map((line) => line.lineAmount)), netAdjustment(invoice.allowancesCharges));
  // BR-CO-14: BT-110 = Σ BT-117 (exact).
  const expectedTaxAmountTotal = (): Decimal => sumMoney(breakdownTaxAmounts);
  const totalMismatch = (stated: number, expected: () => Decimal): boolean =>
    differsBy(stated, expected, TOTALS_TOLERANCE_CENTS);

  // --- Document-level totals ----------------------------------------------
  checkDecimalPrecision(invoice.taxExclusiveAmount, "taxExclusiveAmount", issues);
  checkDecimalPrecision(invoice.taxAmount, "taxAmount", issues);
  checkDecimalPrecision(invoice.taxInclusiveAmount, "taxInclusiveAmount", issues);
  checkDecimalPrecision(invoice.duePayableAmount, "duePayableAmount", issues);
  if (invoice.roundingAmount !== undefined) {
    checkDecimalPrecision(invoice.roundingAmount, "roundingAmount", issues);
  }
  // BR-DEC-16: BT-113 paid amount has at most 2 decimals. Without this check a value like 10.005 would be
  // rounded silently (to 10.01) by the BR-CO-16 check and in the XML.
  if (invoice.prepaidAmount !== undefined) {
    checkDecimalPrecision(invoice.prepaidAmount, "prepaidAmount", issues);
  }

  // BT-109 taxExclusiveAmount = Σ line net amounts − document allowances + document charges (BR-CO-13).
  if (totalMismatch(invoice.taxExclusiveAmount, expectedTaxExclusiveAmount)) {
    issues.push({
      code: "INVOICE_TAX_EXCLUSIVE_AMOUNT_MISMATCH",
      severity: "error",
      message: `taxExclusiveAmount: BT-109 amount ${invoice.taxExclusiveAmount} does not match the sum of line net amounts minus document allowances plus document charges (${expectedText(expectedTaxExclusiveAmount)}).`,
      path: "taxExclusiveAmount",
    });
  }

  // BT-110 taxAmount = sum of all breakdown taxAmounts.
  if (totalMismatch(invoice.taxAmount, expectedTaxAmountTotal)) {
    issues.push({
      code: "INVOICE_TAX_AMOUNT_MISMATCH",
      severity: "error",
      message: `taxAmount: BT-110 total VAT amount ${invoice.taxAmount} does not match the sum of VAT breakdown amounts (${expectedText(expectedTaxAmountTotal)}).`,
      path: "taxAmount",
    });
  }

  // BT-112 taxInclusiveAmount = taxExclusiveAmount + taxAmount.
  const expectedTaxInclusiveAmount = (): Decimal => add(money(invoice.taxExclusiveAmount), money(invoice.taxAmount));
  if (totalMismatch(invoice.taxInclusiveAmount, expectedTaxInclusiveAmount)) {
    issues.push({
      code: "INVOICE_TAX_INCLUSIVE_AMOUNT_MISMATCH",
      severity: "error",
      message: `taxInclusiveAmount: BT-112 amount ${invoice.taxInclusiveAmount} does not match taxExclusiveAmount + taxAmount (${expectedText(expectedTaxInclusiveAmount)}).`,
      path: "taxInclusiveAmount",
    });
  }

  // BR-CO-16: BT-115 = BT-112 − BT-113 + BT-114.
  const expectedDuePayableAmount = (): Decimal =>
    add(
      sub(money(invoice.taxInclusiveAmount), invoice.prepaidAmount === undefined ? ZERO : money(invoice.prepaidAmount)),
      invoice.roundingAmount === undefined ? ZERO : money(invoice.roundingAmount),
    );
  if (totalMismatch(invoice.duePayableAmount, expectedDuePayableAmount)) {
    issues.push({
      code: "INVOICE_DUE_PAYABLE_AMOUNT_MISMATCH",
      severity: "error",
      message: `duePayableAmount: BT-115 amount ${invoice.duePayableAmount} does not match taxInclusiveAmount minus prepaidAmount plus roundingAmount (${expectedText(expectedDuePayableAmount)}).`,
      path: "duePayableAmount",
    });
  }

  // --- Place of supply (informational only — never blocks XML generation) ------------------
  // The schema doesn't distinguish goods from services, so this can't be resolved
  // automatically; flag cross-border invoices so the place of supply can be verified by hand.
  if (invoice.seller.address.countryCode !== invoice.buyer.address.countryCode) {
    const placeOfSupplyIfB2BService = resolvePlaceOfSupply(invoice.seller, invoice.buyer, true);
    issues.push({
      code: "PLACE_OF_SUPPLY_CROSS_BORDER",
      severity: "warning",
      message: `Seller (${invoice.seller.address.countryCode}) and buyer (${invoice.buyer.address.countryCode}) are in different countries. Place of supply defaults to the seller's country for goods, but to the buyer's country (${placeOfSupplyIfB2BService}) for B2B services — verify manually which applies.`,
      path: "buyer.address.countryCode",
    });
  }

  return issues;
}
