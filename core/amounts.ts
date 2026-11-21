/**
 * Public amount calculations (exported from `openinvoicexml`, `openinvoicexml/adapters` and `openinvoicexml/browser`).
 *
 * The same exact decimal arithmetic the engine's own checks use (`validateBusinessRules`), so amounts computed here
 * pass those checks. Plain numbers in, plain numbers out; the decimal type behind it stays private.
 * Rules and examples: docs/API.md "Amount calculations", docs/DATA-MODEL.md "Rounding".
 *
 * - Rounding: half away from zero to 2 decimals (0.165 → 0.17, −0.165 → −0.17), on the exact decimal value of each
 *   input (read through `String(n)`: 0.0055 is exactly 0.0055).
 * - Invalid input (NaN, ±Infinity, a non-number, or a MONEY input with more than 2 decimals) gives NaN instead of
 *   throwing or rounding silently, so the result can be passed on and `validateBusinessRules` reports it.
 *   Money inputs: allowance/charge amounts, the taxable amount, summed amounts. Quantities, unit prices and VAT
 *   rates may have any number of decimals.
 */

import type { AllowanceCharge } from "./types/allowance-charge.js";
import { toNumber as decimalToNumber } from "./utils/decimal.js";
import { lineNetAmount, money, sumMoney, vatAmount } from "./utils/monetary.js";

/** The part of an allowance/charge that changes an amount. */
export type AmountAdjustment = Pick<AllowanceCharge, "amount" | "isCharge">;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * A money amount must have at most 2 decimals (BR-DEC-*). Binary noise up to 1e-9 (e.g. 0.1 + 0.2) is accepted, the
 * same tolerance as validateBusinessRules' MONETARY_AMOUNT_DECIMAL_PRECISION check; anything else is invalid input
 * and is never rounded silently.
 */
const isMoneyAmount = (value: unknown): value is number =>
  isFiniteNumber(value) && Math.abs(value - decimalToNumber(money(value))) <= 1e-9;

/**
 * BT-131 invoice line net amount, as Peppol BIS Billing 3.0 / PEPPOL-EN16931-R120 define it:
 * `round2(quantity × unitPrice)` on its own, then line charges added and line allowances subtracted.
 *
 *     calculateLineNetAmount(30, 0.0055)                                      // 0.17  (exact 0.165)
 *     calculateLineNetAmount(-30, 0.0055)                                     // -0.17 (credit-note line)
 *     calculateLineNetAmount(2, 95, [{ amount: 10, isCharge: false }])        // 180
 *     calculateLineNetAmount(1, 0.005, [{ amount: 1, isCharge: false }])     // -0.99 (0.01 − 1.00)
 *
 * @returns the line net amount with at most 2 decimals, or NaN if any input is not a finite number or an
 *   allowance/charge amount has more than 2 decimals
 */
export function calculateLineNetAmount(
  quantity: number,
  unitPrice: number,
  allowancesCharges?: readonly AmountAdjustment[],
): number {
  // Plain-JavaScript callers may pass anything: check the shape before using it.
  const raw: unknown = allowancesCharges ?? [];
  if (!Array.isArray(raw)) return Number.NaN;
  const validAdjustment = (ac: unknown): boolean =>
    typeof ac === "object" && ac !== null && isMoneyAmount((ac as { amount?: unknown }).amount);
  if (!isFiniteNumber(quantity) || !isFiniteNumber(unitPrice) || !raw.every(validAdjustment))
    return Number.NaN;
  return decimalToNumber(lineNetAmount(quantity, unitPrice, allowancesCharges));
}

/**
 * BT-117 VAT amount of one VAT breakdown: `round2(taxableAmount × vatRatePercent ÷ 100)`. The taxable amount is taken
 * as a 2-decimal amount first.
 *
 *     calculateVatAmount(5.69, 19)   // 1.08
 *     calculateVatAmount(0.5, 19)    // 0.1   (exact 0.095)
 *     calculateVatAmount(-0.5, 19)   // -0.1  (exact −0.095)
 *     calculateVatAmount(2750, 7)    // 192.5
 *
 * @returns the VAT amount with at most 2 decimals, or NaN if an input is not a finite number or the taxable amount
 *   has more than 2 decimals
 */
export function calculateVatAmount(taxableAmount: number, vatRatePercent: number): number {
  if (!isMoneyAmount(taxableAmount) || !isFiniteNumber(vatRatePercent)) return Number.NaN;
  return decimalToNumber(vatAmount(money(taxableAmount), vatRatePercent));
}

/**
 * Exact sum of money amounts, each taken as a 2-decimal amount (for BT-106, BT-109, BT-110, BT-112, BT-116, …).
 *
 *     sumAmounts([0.1, 0.2])            // 0.3   (not 0.30000000000000004)
 *     sumAmounts([5.5, 0.17, 0.02])     // 5.69
 *     sumAmounts([])                    // 0
 *
 * @returns the sum with at most 2 decimals, or NaN if any amount is not a finite number or has more than 2 decimals
 */
export function sumAmounts(amounts: readonly number[]): number {
  if (!Array.isArray(amounts) || !amounts.every(isMoneyAmount)) return Number.NaN;
  return decimalToNumber(sumMoney(amounts));
}
