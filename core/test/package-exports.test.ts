import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The amount helpers through the PACKAGE ENTRY POINTS, as a consumer imports them: a separate Node process imports
 * `openinvoicexml`, `openinvoicexml/adapters` and `openinvoicexml/browser` by package name (Node resolves the
 * package's own "exports" map, i.e. the built dist/ files). Needs `npm run build` first (CI and `make all` build
 * before testing); without dist/ the test fails with a clear message instead of passing silently.
 */
const root = fileURLToPath(new URL("../..", import.meta.url));
const built =
  existsSync(`${root}/dist/core/index.js`) && existsSync(`${root}/dist/adapters/browser.js`);

const probe = `
const out = {};
for (const entry of ["openinvoicexml", "openinvoicexml/adapters", "openinvoicexml/browser"]) {
  const m = await import(entry);
  out[entry] = {
    line: m.calculateLineNetAmount(30, 0.0055),
    lineAdj: m.calculateLineNetAmount(1, 0.005, [{ amount: 1, isCharge: false }]),
    vat: m.calculateVatAmount(-0.5, 19),
    sum: m.sumAmounts([0.1, 0.2]),
    invalid: m.calculateLineNetAmount(NaN, 1),
    internals: ["parseDecimal", "fromNumber", "roundHalfAwayFromZero", "round2", "money", "lineNetAmount", "vatAmount", "sumMoney", "Decimal"].filter((n) => n in m),
  };
}
console.log(JSON.stringify(out));
`;

describe("public amount API through the package entry points", () => {
  it("dist/ is built (run `npm run build` before this test)", () => {
    expect(built).toBe(true);
  });

  it.runIf(built)(
    "exports the three helpers from openinvoicexml, /adapters and /browser, and nothing internal",
    () => {
      const stdout = execFileSync(process.execPath, ["--input-type=module", "-e", probe], {
        cwd: root,
        encoding: "utf8",
      });
      const result = JSON.parse(stdout) as Record<
        string,
        {
          line: number;
          lineAdj: number;
          vat: number;
          sum: number;
          invalid: number | null;
          internals: string[];
        }
      >;
      for (const entry of ["openinvoicexml", "openinvoicexml/adapters", "openinvoicexml/browser"]) {
        expect(result[entry], entry).toEqual({
          line: 0.17,
          lineAdj: -0.99,
          vat: -0.1,
          sum: 0.3,
          invalid: null,
          internals: [],
        });
      }
    },
  );
});
