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

// to prevent this kinda situation
// example) 0.1 + 0.2 // 0.30000000000000004
export function isClose(a: number, b: number, tolerance = TOLERANCE): boolean {
  return Math.abs(a - b) <= tolerance;
}

// example)
// round2(19.999); // 20
// round2(19.994); // 19.99
// round2(123.4567); // 123.46
// 123.4567 * 100
// 12345.67
// Math.round(12345.67)
// 12346
// 12346 / 100
// 123.46
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
