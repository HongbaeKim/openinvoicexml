import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { strictValidation } from "../../validators/test/validator-availability.test-helpers.js";

/**
 * The amount helpers through the PACKAGE ENTRY POINTS, as a consumer imports them: a separate Node process imports
 * `openinvoicexml`, `openinvoicexml/adapters` and `openinvoicexml/browser` by package name (Node resolves the
 * package's own "exports" map, i.e. the built dist/ files). Needs `npm run build` first: CI builds before testing
 * (ci.yml "Build" step), and so does `make all`.
 *
 * A missing dist/ follows the same rule as a missing external validator (validator-availability.test-helpers.ts):
 * in strict mode (CI, or OPENINVOICE_STRICT_VALIDATION) the test fails and lists the missing files; locally it is
 * skipped, with the reason in the test name, so `npm install && npm test` on a fresh clone stays green.
 * A dist/ from an older build tests that older code: rebuild after changing the source.
 */
const root = fileURLToPath(new URL("../..", import.meta.url));

/** The package "exports" subpaths this test imports, read from package.json so the two can't drift apart. */
const ENTRY_POINTS = {
  openinvoicexml: ".",
  "openinvoicexml/adapters": "./adapters",
  "openinvoicexml/browser": "./browser",
};
const packageExports = (
  JSON.parse(readFileSync(`${root}/package.json`, "utf8")) as {
    exports: Record<string, { import?: string } | undefined>;
  }
).exports;
const missingEntryPoints = Object.entries(ENTRY_POINTS).flatMap(([entry, subpath]) => {
  const file = packageExports[subpath]?.import;
  if (file === undefined) return [`${entry} (no "exports" entry for ${subpath})`];
  return existsSync(`${root}/${file}`) ? [] : [`${entry} → ${file}`];
});
const built = missingEntryPoints.length === 0;
const strict = strictValidation();
const notBuiltReason = `dist/ is not built (missing: ${missingEntryPoints.join(", ")}); run \`npm run build\` first`;

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

const EXPORT_TEST_NAME =
  "exports the three helpers from openinvoicexml, /adapters and /browser, and nothing internal";

describe("public amount API through the package entry points", () => {
  // Built: run. Not built + strict (CI): run, so the first assertion fails and names the missing files.
  // Not built + local: skip, and say why in the name (Vitest prints it in the skipped list).
  const exportTest = built || strict ? it : it.skip;
  exportTest(
    built || strict ? EXPORT_TEST_NAME : `${EXPORT_TEST_NAME} [skipped locally: ${notBuiltReason}]`,
    () => {
      expect(
        missingEntryPoints,
        `${notBuiltReason}. Strict mode (CI) requires the package-export check to run.`,
      ).toEqual([]);
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
