import { describe, expect, it } from "vitest";

import {
  centsApart,
  formatAmount,
  formatUnitPrice,
  money,
  moneyText,
  netAdjustment,
  round2,
  sumMoney,
} from "../monetary.js";
import { parseDecimal } from "../decimal.js";

/**
 * Tests rounding numbers to 2 decimal places.
 *
 * Uses "half away from zero":
 *   0.165  →  0.17
 *  -0.165  → -0.17
 *   1.005  →  1.01
 *
 * This prevents incorrect rounding caused by JavaScript's
 * floating-point representation.
 */
describe("round2 (exact decimal, half away from zero)", () => {
  it.each([
    [0.165, 0.17],
    [-0.165, -0.17],
    [0.055, 0.06],
    [1.005, 1.01],
    [3.015, 3.02],
    [2.675, 2.68],
    [19.994, 19.99],
    [19.999, 20],
    [123.4567, 123.46],
    [0, 0],
  ])("round2(%d) = %d", (value, expected) => {
    expect(round2(value)).toBe(expected);
  });

  it("keeps NaN as NaN", () => {
    expect(round2(Number.NaN)).toBeNaN();
  });
});

/**
 * Tests money calculations using exact decimal arithmetic.
 *
 * JavaScript can produce small floating-point errors:
 *   0.1 + 0.2 = 0.30000000000000004
 *
 * Our money helpers should produce correctly rounded
 * monetary amounts instead.
 */
describe("money / sums", () => {
  /**
   * Removes small floating-point errors when converting
   * values into 2-decimal monetary amounts.
   *
   * Example:
   *   0.1 + 0.2 = 0.30000000000000004
   *   moneyText(money(0.1 + 0.2)) = "0.30"
   *
   * Summing monetary amounts should also give 0.60,
   * not a value with unwanted extra decimal digits.
   */
  it("removes binary noise from 2-decimal amounts", () => {
    expect(moneyText(money(0.1 + 0.2))).toBe("0.30");
    expect(moneyText(sumMoney([0.1, 0.2, 0.3]))).toBe("0.60");
  });

  /**
   * Checks that charges increase the amount and
   * allowances (discounts) decrease it.
   *
   * Example:
   *   Charge:      2.50
   *   Discount 1: -0.10
   *   Discount 2: -0.20
   *
   *   2.50 - 0.10 - 0.20 = 2.20
   *
   * If there are no adjustments, the result is 0.00.
   */
  it("nets charges and allowances exactly", () => {
    expect(
      moneyText(
        netAdjustment([
          { amount: 2.5, isCharge: true },
          { amount: 0.1, isCharge: false },
          { amount: 0.2, isCharge: false },
        ]),
      ),
    ).toBe("2.20");
    expect(moneyText(netAdjustment(undefined))).toBe("0.00");
  });

  /**
   * Measures the absolute difference between two amounts in cents.
   *
   * Examples:
   *   0.17 and 0.16 differ by 1 cent.
   *  -0.17 and 0.17 differ by 34 cents.
   *   5.69 and 5.690 have no difference.
   *
   * The result is a BigInt representing whole cents.
   */
  it("measures differences in whole cents", () => {
    expect(centsApart(parseDecimal("0.17"), parseDecimal("0.16"))).toBe(1n);
    expect(centsApart(parseDecimal("-0.17"), parseDecimal("0.17"))).toBe(34n);
    expect(centsApart(parseDecimal("5.69"), parseDecimal("5.690"))).toBe(0n);
  });
});

/**
 * Tests how monetary amounts and unit prices are written as text.
 *
 * Invoice amounts normally use 2 decimal places.
 * Unit prices may need more decimal places for small prices.
 *
 * Example:
 *   Invoice amount: 10.5   → "10.50"
 *   Unit price:     0.0055 → "0.0055"
 *
 * Keeping unit-price precision is important for
 * accurate invoice calculations.
 */
describe("formatAmount / formatUnitPrice", () => {
  /**
   * Formats invoice amounts with exactly 2 decimal places.
   *
   * Examples:
   *   10.5    → "10.50"
   *   1190    → "1190.00"
   *   -0.001  → "0.00"
   *
   * Very large numbers must be written normally,
   * without scientific notation such as "1e+21".
   *
   * This helps produce predictable monetary values in XML.
   */
  it("writes 2 decimals from the exact decimal value", () => {
    expect(formatAmount(10.5)).toBe("10.50");
    expect(formatAmount(0.1 + 0.2)).toBe("0.30");
    expect(formatAmount(1190)).toBe("1190.00");
    expect(formatAmount(-1000)).toBe("-1000.00");
    expect(formatAmount(-0.001)).toBe("0.00"); // no "-0.00"
    expect(formatAmount(1e21)).toBe("1000000000000000000000.00"); // no exponent in XML
  });

  /**
   * Formats unit prices with at least 2 and up to 10 decimal places.
   *
   * Unlike invoice totals, unit prices may require more precision.
   *
   * Examples:
   *   125      → "125.00"
   *   12.5     → "12.50"
   *   0.0055   → "0.0055"
   *   0.0000001 → "0.0000001"
   *
   * Keeping these digits allows accurate multiplication
   * before the final line amount is rounded to cents.
   */
  it("keeps up to 10 decimals for unit prices, at least 2", () => {
    expect(formatUnitPrice(125)).toBe("125.00");
    expect(formatUnitPrice(12.5)).toBe("12.50");
    expect(formatUnitPrice(0.0055)).toBe("0.0055");
    expect(formatUnitPrice(1.2345)).toBe("1.2345");
    expect(formatUnitPrice(1e-7)).toBe("0.0000001");
    expect(formatUnitPrice(0.0000000001)).toBe("0.0000000001");
  });
});
