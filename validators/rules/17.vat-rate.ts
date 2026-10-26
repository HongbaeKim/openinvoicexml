import type { VatCategoryCode } from "../../core/types/vat-breakdown.js";
import type { ValidationIssue } from "../types.js";
import { isClose, round2 } from "../../core/utils/monetary.js";

/**
 * Checks BT-118/BT-119 (VAT rate) and BT-120/BT-121 (exemption reason presence) rules.
 *
 * @see ../../docs/COMPLIANCE.md for the EN 16931 source of these BT-* rules.
 */

/**
 * Categories that must carry a zero VAT rate (no VAT charged on the invoice).
 *
 * Validation requirement: EN 16931 BR-Z-05, BR-E-05, BR-AE-05, BR-IC-05 and BR-G-05 require a
 * 0 rate on lines of these categories. Category 'O' is listed too because this model stores 0
 * for it; how it is rendered is covered in docs/DATA-MODEL.md and 14.outside-scope.ts.
 */
export const ZERO_RATE_CATEGORIES: VatCategoryCode[] = ["Z", "E", "AE", "K", "G", "O"];

/**
 * Rates permitted for category 'S' (German standard/reduced VAT rates).
 *
 * Project decision, not an EN 16931 or legal limit: EN 16931 only requires an 'S' rate above 0
 * (BR-S-05), and §12 UStG sets the German rates. OpenInvoiceXML targets current German
 * invoicing, so it accepts 19% and 7% only. Historical rates (e.g. the 2020 COVID-era 16%/5%)
 * and other EU member states' rates are out of scope and fail as VAT_RATE_INVALID_FOR_CATEGORY.
 * Widening support means changing this list, not working around the check; 
 * see docs/LIMITATIONS.md.
 */
export const STANDARD_VAT_RATES: number[] = [19, 7];

/**
 * Categories for which BT-120/BT-121 (exemption reason) is mandatory per EN 16931.
 *
 * Validation requirement: BR-E-10, BR-AE-10, BR-IC-10, BR-G-10 and BR-O-10 each require an
 * exemption reason code or text on a VAT breakdown of that category. The inverse (no reason on
 * 'S' or 'Z') is checked in 02.business-rules.ts.
 */
export const EXEMPTION_REASON_REQUIRED_CATEGORIES: VatCategoryCode[] = ["E", "AE", "K", "G", "O"];

export function checkDecimalPrecision(
  value: number,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isClose(value, round2(value), 1e-9)) {
    issues.push({
      code: "MONETARY_AMOUNT_DECIMAL_PRECISION",
      severity: "error",
      message: `${path}: monetary amount ${value} must be expressed with at most 2 decimal places.`,
      path,
    });
  }
}

export function checkVatRateForCategory(
  categoryCode: VatCategoryCode,
  rate: number,
  path: string,
  issues: ValidationIssue[],
): void {
  if (categoryCode === "S") {
    if (!STANDARD_VAT_RATES.includes(rate)) {
      issues.push({
        code: "VAT_RATE_INVALID_FOR_CATEGORY",
        severity: "error",
        message: `${path}: BT-118/BT-119 category 'S' requires a VAT rate of 19% or 7%, found ${rate}%.`,
        path,
      });
    }
  } else if (ZERO_RATE_CATEGORIES.includes(categoryCode)) {
    if (rate !== 0) {
      issues.push({
        code: "VAT_RATE_INVALID_FOR_CATEGORY",
        severity: "error",
        message: `${path}: BT-118/BT-119 category '${categoryCode}' requires a VAT rate of 0%, found ${rate}%.`,
        path,
      });
    }
  }
}
