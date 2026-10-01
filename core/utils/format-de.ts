import { MAX_UNIT_PRICE_DECIMALS } from "./monetary.js";

/**
 * German-locale display formatting for the hybrid PDF adapter. Not XML/machine formats
 * (see xml.ts's amt() for that) — these produce human-readable German text.
 */

/**
 * Formats a YYYY-MM-DD calendar date as German DD.MM.YYYY.
 *
 * Deliberately a plain string transform, not `new Date(isoDate)` + `Intl.DateTimeFormat`:
 * Invoice dates are calendar dates, not timestamps, and parsing them through `Date` risks a
 * timezone-dependent off-by-one-day shift depending on the runtime's local timezone.
 */
export function formatDateDE(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

/**
 * Formats a monetary amount as German-locale currency text, e.g. formatAmountDE(1190, "EUR")
 * -> "1.190,00 €". Uses Intl.NumberFormat since the input is a plain number with no
 * parsing/timezone hazard (unlike formatDateDE's string input).
 */
export function formatAmountDE(value: number, currencyCode: string): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: currencyCode }).format(
    value,
  );
}

/**
 * Formats a unit price (BT-146) for display.
 *
 * Unlike normal money amounts, a unit price can have more than 2 decimal places.
 * For example:
 *
 *   formatUnitPriceDE(0.0055, "EUR") -> "0,0055 €"
 *
 * We must keep these extra decimals instead of rounding the price to "0,01 €".
 *
 * Example:
 *   unit price = 0.0055 €
 *   quantity   = 1000
 *   line total = 5.50 €
 *
 * If we displayed the unit price as "0,01 €", it would look like:
 *   0.01 € × 1000 = 10.00 €
 *
 * That would not match the real line total of 5.50 €.
 *
 * MAX_UNIT_PRICE_DECIMALS controls how many decimal places we keep.
 */
export function formatUnitPriceDE(value: number, currencyCode: string): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: MAX_UNIT_PRICE_DECIMALS,
  }).format(value);
}
