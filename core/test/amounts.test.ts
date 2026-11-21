import { describe, expect, it } from "vitest";

import { calculateLineNetAmount, calculateVatAmount, sumAmounts, type Invoice } from "../index.js";

describe("calculateLineNetAmount (BT-131)", () => {
  it.each([
    [30, 0.0055, 0.17],
    [-30, 0.0055, -0.17],
    [10, 0.0055, 0.06],
    [1, 1.005, 1.01],
    [3, 1.005, 3.02],
    [1000, 0.0055, 5.5],
    [2, 95, 190],
    [-8, 125, -1000],
    [0.333333, 3, 1],
    [1e7, 1e-7, 1],
    [1_000_000, 9999.9999, 9_999_999_900],
    [0, 123.45, 0],
  ])("%d × %d = %d", (quantity, unitPrice, expected) => {
    expect(calculateLineNetAmount(quantity, unitPrice)).toBe(expected);
  });

  it("rounds quantity × price on its own, then applies charges and allowances (Peppol R120)", () => {
    expect(calculateLineNetAmount(2, 95, [{ amount: 10, isCharge: false }])).toBe(180);
    expect(
      calculateLineNetAmount(30, 0.0055, [
        { amount: 0.5, isCharge: true },
        { amount: 0.1, isCharge: false },
      ]),
    ).toBe(0.57);
    expect(calculateLineNetAmount(1, 0.005, [{ amount: 1, isCharge: false }])).toBe(-0.99);
  });

  it("never returns -0", () => {
    expect(Object.is(calculateLineNetAmount(-1, 0.004), 0)).toBe(true);
  });

  it.each([
    [Number.NaN, 1],
    [1, Number.POSITIVE_INFINITY],
    [Number.NEGATIVE_INFINITY, 1],
    ["2" as unknown as number, 1],
  ])("returns NaN for invalid input (%s, %s)", (quantity, unitPrice) => {
    expect(calculateLineNetAmount(quantity, unitPrice)).toBeNaN();
  });

  it("returns NaN for an invalid adjustment", () => {
    expect(calculateLineNetAmount(1, 1, [{ amount: Number.NaN, isCharge: false }])).toBeNaN();
    expect(
      calculateLineNetAmount(1, 1, [null as unknown as { amount: number; isCharge: boolean }]),
    ).toBeNaN();
    expect(calculateLineNetAmount(1, 1, "x" as unknown as [])).toBeNaN();
  });
});

describe("calculateVatAmount (BT-117)", () => {
  it.each([
    [5.69, 19, 1.08],
    [0.5, 19, 0.1],
    [-0.5, 19, -0.1],
    [2.5, 7, 0.18],
    [-2.5, 7, -0.18],
    [2750, 7, 192.5],
    [2675, 19, 508.25],
    [100, 0, 0],
    [0.1 + 0.2, 19, 0.06],
  ])("%d × %d %% = %d", (taxable, rate, expected) => {
    expect(calculateVatAmount(taxable, rate)).toBe(expected);
  });

  it("returns NaN for invalid input", () => {
    expect(calculateVatAmount(Number.NaN, 19)).toBeNaN();
    expect(calculateVatAmount(100, Number.POSITIVE_INFINITY)).toBeNaN();
  });
});

describe("sumAmounts", () => {
  it("adds exactly", () => {
    expect(sumAmounts([0.1, 0.2])).toBe(0.3);
    expect(sumAmounts([5.5, 0.17, 0.02])).toBe(5.69);
    expect(sumAmounts([5425, 700.75])).toBe(6125.75);
    expect(sumAmounts([-1000, 1320, -100])).toBe(220);
    expect(sumAmounts([])).toBe(0);
  });

  it("returns NaN for invalid input", () => {
    expect(sumAmounts([1, Number.NaN])).toBeNaN();
    expect(sumAmounts("x" as unknown as number[])).toBeNaN();
  });
});

describe("agrees with validateBusinessRules", () => {
  it("amounts computed with these helpers pass the engine's own checks", async () => {
    const { validateBusinessRules } = await import("../../validators/engines/02.business-rules.js");
    const { domesticSimple } = await import("../../fixtures/index.js");
    const base = JSON.parse(JSON.stringify(domesticSimple)) as Invoice;
    const lines = [
      { quantity: 1000, unitPrice: 0.0055 },
      { quantity: 30, unitPrice: 0.0055 },
      { quantity: 3, unitPrice: 0.0055 },
    ].map((l, i) => ({
      ...base.lines[0]!,
      id: String(i + 1),
      ...l,
      lineAmount: calculateLineNetAmount(l.quantity, l.unitPrice),
    }));
    const taxable = sumAmounts(lines.map((l) => l.lineAmount));
    const tax = calculateVatAmount(taxable, 19);
    const inclusive = sumAmounts([taxable, tax]);
    const invoice: Invoice = {
      ...base,
      lines,
      vatBreakdowns: [{ categoryCode: "S", rate: 19, taxableAmount: taxable, taxAmount: tax }],
      taxExclusiveAmount: taxable,
      taxAmount: tax,
      taxInclusiveAmount: inclusive,
      duePayableAmount: inclusive,
    };
    expect([taxable, tax, inclusive]).toEqual([5.69, 1.08, 6.77]);
    const amountIssues = validateBusinessRules(invoice).filter((i) =>
      /AMOUNT|ROUNDING|PRECISION/.test(i.code),
    );
    expect(amountIssues).toEqual([]);
  });
});
