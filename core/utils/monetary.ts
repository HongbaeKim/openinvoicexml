 /**
 * Maximum absolute difference allowed between a computed and stated monetary amount.
 * Default tolerance for comparing money amounts.
 *
 * We use 0.01, not 0.02.
 *
 * XRechnung allows ±0.02 only for PEPPOL-EN16931-R120, which checks
 * a line amount (BT-131) against quantity × unit price.
 *
 * Invoice totals are stricter. BR-CO-16 requires:
 * BT-115 = BT-112 - BT-113 + BT-114
 *
 * BT-112 = invoice total with VAT
 * BT-113 = amount already paid
 * BT-114 = rounding amount
 * BT-115 = amount due
 *
 * If the final total needs a rounding adjustment, use `roundingAmount`
 * (BT-114) instead of allowing a larger tolerance.
 *
 * A specific check can pass its own tolerance to isClose() if needed.
 */
export const TOLERANCE = 0.01;

/**
 * Maximum decimal places for a unit price (BT-146).
 *
 * BT-146 is the price for one unit, not a final money total.
 * EN 16931 does not require it to have only 2 decimal places,
 * so prices like 0.0055 per item are valid.
 *
 * The limit of 10 prevents floating-point noise and values like `1e-7`
 * from appearing in the XML/PDF.
 */
export const MAX_UNIT_PRICE_DECIMALS = 10;

import {
  abs,
  add,
  fromNumber,
  mul,
  roundHalfAwayFromZero,
  shiftLeft,
  sub,
  sum,
  toFixedText,
  toNumber,
  type Decimal,
} from "./decimal.js";

// Float comparison with a tolerance. Kept for checks that only filter binary noise
// (e.g. checkDecimalPrecision with 1e-9); money comparisons use exact cents (centsApart below).
// example) 0.1 + 0.2 // 0.30000000000000004
export function isClose(a: number, b: number, tolerance = TOLERANCE): boolean {
  return Math.abs(a - b) <= tolerance;
}

/**
 * Rounds a number to 2 decimal places (half away from zero).
 *
 * Example 1: Normal rounding
 * round2(19.999);  // 20
 * round2(19.994);  // 19.99
 * round2(123.4567); // 123.46
 *
 * Example 2: Half-cent rounding
 * round2(0.165);   // 0.17
 * round2(-0.165);  // -0.17
 * round2(1.005);   // 1.01
 *
 * How rounding works:
 * 123.4567 → 123.46
 *
 * Important:
 * JavaScript multiplication can produce small floating-point errors.
 *
 * Example (old approach):
 * Math.round(30 * 0.0055 * 100) / 100; // 0.16 (incorrect)
 *
 * Example (new approach):
 * lineNetAmount(30, 0.0055); // 0.17 (correct)
 *
 * round2() rounds the number it receives, not the exact
 * mathematical result of an earlier calculation.
 *
 * For invoice calculations, use lineNetAmount() or vatAmount().
 * These calculate with exact decimal arithmetic before rounding.
 *
 * Special values:
 * NaN and Infinity are returned unchanged for backward compatibility.
 */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return value;
  return toNumber(roundHalfAwayFromZero(fromNumber(value), 2));
}

/** A money amount (2 decimals), half away from zero; binary noise like 0.30000000000000004 becomes 0.30. */
export function money(value: number): Decimal {
  return roundHalfAwayFromZero(fromNumber(value), 2);
}

export interface AmountAdjustment {
  amount: number;
  isCharge: boolean;
}

/** Σ charges − Σ allowances (each amount taken as 2-decimal money). Exact. */
export function netAdjustment(adjustments: readonly AmountAdjustment[] | undefined): Decimal {
  return sum((adjustments ?? []).map((ac) => (ac.isCharge ? money(ac.amount) : money(-ac.amount))));
}

/**
 * Calculates the invoice line net amount (BT-131).
 *
 * First, multiply quantity by unit price and round to 2 decimals.
 * Then add any extra charges and subtract any discounts (allowances).
 *
 * Important: Round the price calculation BEFORE applying discounts.
 * This follows Peppol BIS Billing 3.0 rule R120 for the supported model.
 *
 * Example:
 *   Quantity:  1
 *   Price:     0.005
 *   Discount:  1.00
 *
 *   Step 1: 1 × 0.005 = 0.005 → round to 0.01
 *   Step 2: 0.01 − 1.00 = -0.99
 *
 *   Correct result: -0.99
 *
 *   Incorrect: round(0.005 − 1.00) = round(-0.995) = -1.00
 *
 * Always round the price calculation first, not the final sum.
 */
export function lineNetAmount(
  quantity: number,
  unitPrice: number,
  adjustments?: readonly AmountAdjustment[],
): Decimal {
  const component = roundHalfAwayFromZero(mul(fromNumber(quantity), fromNumber(unitPrice)), 2);
  return add(component, netAdjustment(adjustments));
}

/** BT-117 VAT amount for one category: taxable × rate ÷ 100, exact, rounded half away from zero to 2 decimals. */
export function vatAmount(taxableAmount: Decimal, ratePercent: number): Decimal {
  return roundHalfAwayFromZero(shiftLeft(mul(taxableAmount, fromNumber(ratePercent)), 2), 2);
}

/** Exact sum of 2-decimal money amounts. */
export function sumMoney(values: readonly number[]): Decimal {
  return sum(values.map(money));
}

/** |a − b| in whole cents (both rounded to 2 decimals first). */
export function centsApart(a: Decimal, b: Decimal): bigint {
  return abs(sub(roundHalfAwayFromZero(a, 2), roundHalfAwayFromZero(b, 2))).units;
}

/** "0.17", "-1000.00". Writes the exact 2-decimal money value (no float toFixed). */
export function moneyText(value: Decimal): string {
  return toFixedText(value, 2);
}

// Money amount as XML text with exactly 2 decimals, from the exact decimal value (half away from zero),
// e.g. formatAmount(10.5) → "10.50", formatAmount(0.1 + 0.2) → "0.30". Non-finite input keeps the old toFixed text.
export function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return value.toFixed(2);
  return toFixedText(fromNumber(value), 2);
}

// Unit price (BT-146): always uses at least 2 decimal places, but keeps extra decimals
// when needed (up to MAX_UNIT_PRICE_DECIMALS, rounded half away from zero on the exact decimal value).
// Unlike formatAmount(), it does not round every value to 2 decimals.
//
// Examples:
//   formatUnitPrice(125)      -> "125.00"
//   formatUnitPrice(12.5)     -> "12.50"
//   formatUnitPrice(0.5)      -> "0.50"
//   formatUnitPrice(0.0055)   -> "0.0055"
//   formatUnitPrice(1.2345)   -> "1.2345"
//   formatUnitPrice(1e-7)     -> "0.0000001"
//
// This is important because formatAmount(0.0055) would write "0.01", which would change the
// actual unit price. Unit prices (BT-146) are allowed to have more than 2 decimals.
export function formatUnitPrice(value: number): string {
  if (!Number.isFinite(value)) return value.toFixed(MAX_UNIT_PRICE_DECIMALS);
  return toFixedText(fromNumber(value), MAX_UNIT_PRICE_DECIMALS).replace(/(\.\d\d\d*?)0+$/, "$1");
}
