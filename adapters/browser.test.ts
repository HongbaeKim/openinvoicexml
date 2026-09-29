import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";

import { generateInvoiceXml, toXRechnung, validateBusinessRules } from "./browser.js";
import type { Invoice } from "../core/index.js";

import { allFixtures, domesticSimple, intraEuSupply, reducedRate } from "../fixtures/index.js";

// Browser entry policy (a project policy, not just "what browsers can't parse"):
//
// every module reachable from adapters/browser.ts — via static imports, re-exports, side-effect
// imports or dynamic import() — must not have:
//
//   - a dynamic import() whose argument isn't a string literal (the walker can't follow it)
//   - a node:* specifier
//   - a Node built-in without the node: prefix (fs, path, os, child_process, ...)
//   - a bare package specifier not listed in ALLOWED_PACKAGES
//   - fileURLToPath (module URL → filesystem path, as hybrid-pdf.ts does for its fonts)
// import.meta.url on its own is allowed: `new URL("./asset.svg", import.meta.url)` is valid
// browser code. Type-only imports/exports are skipped because they're erased at compile time.

// This is the browser dependency allowlist.
const ALLOWED_PACKAGES: ReadonlySet<string> = new Set();
// Node gives you a list of its built-in modules
const NODE_BUILTINS: ReadonlySet<string> = new Set(builtinModules);

// Where is this test running inside the repository?
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Start the browser dependency check at adapters/browser.ts
const BROWSER_ENTRY = join(REPO_ROOT, "adapters/browser.ts");

// This defines what your browser-code scanner returns.
interface WalkResult {
  /** Visited files, relative to the walk root, sorted. 
    "adapters/browser.ts",
    "adapters/xrechnung.ts",
    "validators/..."
  **/
  visited: string[];
  /** One readable message per policy violation, sorted. */
  violations: string[];
}

//
//
// First part is: Can this code safely run in a browser?
//
//

/** Returns the package name of a bare specifier: "@scope/pkg/sub" → "@scope/pkg", "pkg/sub" → "pkg". */
function packageName(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
}

/** Checks one non-relative specifier against the policy; returns a reason or null if allowed. */
function bareSpecifierViolation(specifier: string): string | null {
  if (specifier.startsWith("node:")) return "no node:* imports";
  const name = packageName(specifier);
  if (NODE_BUILTINS.has(name)) return "no Node built-ins, with or without the node: prefix";
  if (!ALLOWED_PACKAGES.has(name)) return "package is not in ALLOWED_PACKAGES";
  return null;
}

/** Runtime module specifiers used by one file, plus any non-literal dynamic import() calls. */
function collectSpecifiers(sourceFile: ts.SourceFile): {
  specifiers: string[];
  nonLiteralDynamicImports: string[];
  usesFileURLToPath: boolean;
} {
  const specifiers: string[] = [];
  const nonLiteralDynamicImports: string[] = [];
  let usesFileURLToPath = false;

  // Look at this piece of code and see whether it's something I care about.
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      const isTypeOnly = node.importClause?.isTypeOnly === true;
      // If this is NOT type-only, and the module name is a normal string literal, then record it. Otherwise, ignore it.
      if (!isTypeOnly && ts.isStringLiteral(node.moduleSpecifier)) {
        specifiers.push(node.moduleSpecifier.text);
      }
    } else if (ts.isExportDeclaration(node)) {
      if (!node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        specifiers.push(node.moduleSpecifier.text);
      }
      // Dynamic import() is a CallExpression whose expression is the ImportKeyword.
      // The argument must be a string literal to be valid for the browser entry policy.
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [argument] = node.arguments;
      if (argument && ts.isStringLiteralLike(argument)) {
        specifiers.push(argument.text);
      } else {
        // This is a dynamic import() whose argument isn't a string literal.
        // The walker can't follow it, so record it as a violation.
        nonLiteralDynamicImports.push(node.getText(sourceFile));
      }
    } else if (ts.isIdentifier(node) && node.text === "fileURLToPath") {
      usesFileURLToPath = true;
    }
    // Now look inside this piece of code and visit all of its children too.
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  return { specifiers, nonLiteralDynamicImports, usesFileURLToPath };
}

/** Walks the runtime import graph from `entry` and reports every browser-policy violation. */
function walkBrowserGraph(entry: string, root: string): WalkResult {
  // Remember which files we've already checked
  const visited = new Set<string>();
  const violations: string[] = [];

  function walk(file: string): void {
    if (visited.has(file)) return;
    visited.add(file);
    const rel = relative(root, file);

    // This reads the real file and stores its contents as plain text in memory
    const source = readFileSync(file, "utf8");
    // This converts that plain text into a TypeScript structure in memory
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    // This looks at the TypeScript structure and finds all the import/export specifiers,
    // plus any dynamic import() calls that aren't string literals, plus whether fileURLToPath is used.
    const { specifiers, nonLiteralDynamicImports, usesFileURLToPath } =
      collectSpecifiers(sourceFile);

    for (const call of nonLiteralDynamicImports) {
      violations.push(
        `${rel} has ${call} (browser entry policy: dynamic import() needs a string literal so it can be checked)`,
      );
    }
    if (usesFileURLToPath) {
      violations.push(
        `${rel} uses fileURLToPath (browser entry policy: no module-URL → filesystem-path loading)`,
      );
    }

    // Now check every import/export specifier to see if it violates the browser entry policy.
    // If it's a relative import, resolve it to a .ts file and walk that too.
    for (const specifier of specifiers) {
      // This is NOT a relative/local import.
      if (!specifier.startsWith(".")) {
        const reason = bareSpecifierViolation(specifier);
        if (reason)
          violations.push(`${rel} imports ${specifier} (browser entry policy: ${reason})`);
        continue;
      }
      // Now we know it's a local import. Resolve it to a .ts file and walk that too.
      const target = resolve(dirname(file), specifier.replace(/\.js$/, ".ts"));
      if (!existsSync(target)) {
        violations.push(
          `${rel} imports ${specifier}, which the walker can't resolve to a .ts file`,
        );
        continue;
      }
      walk(target);
    }
  }
  walk(entry);

  return {
    visited: [...visited].map((file) => relative(root, file)).sort(),
    violations: violations.sort(),
  };
}

describe("browser entry policy (adapters/browser.ts import graph)", () => {
  const result = walkBrowserGraph(BROWSER_ENTRY, REPO_ROOT);

  it("walks well past browser.ts itself (a broken walker must not pass by visiting nothing)", () => {
    expect(result.visited).toContain("adapters/browser.ts");
    expect(result.visited).toContain("adapters/xrechnung.ts");
    expect(result.visited).toContain("validators/engines/02.business-rules.ts");
    expect(result.visited.length).toBeGreaterThan(10);
  });

  it("reaches no Node-only code", () => {
    expect(result.violations).toEqual([]);
  });
});

// Make fake bad code and check that the walker catches it.
// This is a test of the walker itself, not of any real code.
describe("browser entry policy: the walker catches each violation", () => {
  const dir = mkdtempSync(join(tmpdir(), "browser-policy-"));
  // Delete the temporary folder afterward
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  /** Writes `entry.ts` (optional `dep.ts`) and walks from it. */
  function walkSnippet(entrySource: string, depSource?: string): WalkResult {
    const caseDir = mkdtempSync(join(dir, "case-"));
    writeFileSync(join(caseDir, "entry.ts"), entrySource);
    if (depSource !== undefined) writeFileSync(join(caseDir, "dep.ts"), depSource);
    return walkBrowserGraph(join(caseDir, "entry.ts"), caseDir);
  }

  it.each([
    ['import "node:fs";', "entry.ts imports node:fs (browser entry policy: no node:* imports)"],
    [
      'import { readFileSync } from "fs";',
      "entry.ts imports fs (browser entry policy: no Node built-ins",
    ],
    [
      'import * as fontkit from "fontkit";',
      "entry.ts imports fontkit (browser entry policy: package is not in ALLOWED_PACKAGES)",
    ],
    [
      'const fs = await import("node:fs");',
      "entry.ts imports node:fs (browser entry policy: no node:* imports)",
    ],
    [
      "const m = await import(someVar);",
      "entry.ts has import(someVar) (browser entry policy: dynamic import() needs a string literal",
    ],
    [
      'const p = fileURLToPath(new URL("./fonts/", import.meta.url));',
      "entry.ts uses fileURLToPath",
    ],
    [
      'export { x } from "./missing.js";',
      "entry.ts imports ./missing.js, which the walker can't resolve",
    ],
  ])("flags %s", (entrySource, expectedMessageStart) => {
    const { violations } = walkSnippet(entrySource);
    expect(violations.some((v) => v.startsWith(expectedMessageStart))).toBe(true);
  });

  // Check that the walker follows relative imports and re-exports into dependencies, and flags violations there too.
  it("follows relative imports and re-exports into dependencies", () => {
    const { visited, violations } = walkSnippet(
      'export { dep } from "./dep.js";',
      'import "node:os";\nexport const dep = 1;',
    );
    expect(visited).toEqual(["dep.ts", "entry.ts"]);
    expect(violations).toEqual([
      "dep.ts imports node:os (browser entry policy: no node:* imports)",
    ]);
  });

  // Check that the walker ignores type-only imports and exports, which are erased at compile time.
  it("allows import.meta.url on its own and skips type-only imports", () => {
    const { violations } = walkSnippet(
      'import type { Readable } from "node:stream";\nexport const asset = new URL("./asset.svg", import.meta.url);',
    );
    expect(violations).toEqual([]);
  });
});

//
//
// Second part is: Does the browser invoice generator actually bhave correctly?
//
//

/** Deep-clones a fixture so mutations in one test don't leak into others. */
function clone<T>(fixture: T): T {
  return JSON.parse(JSON.stringify(fixture)) as T;
}

/**
 * Expected result built from the underlying engine functions — deliberately not from
 * generateInvoice(), which wraps generateInvoiceXml() and would share any mistake in it.
 */
function expectedResult(invoice: Invoice): {
  xml: string | null;
  issues: ReturnType<typeof validateBusinessRules>;
} {
  const issues = validateBusinessRules(invoice, "XRECHNUNG");
  const hasErrors = issues.some((issue) => issue.severity === "error");
  return { xml: hasErrors ? null : toXRechnung(invoice), issues };
}

describe("generateInvoiceXml", () => {
  it("generates XRechnung XML for a valid invoice", () => {
    const invoice = domesticSimple as Invoice;
    const result = generateInvoiceXml(invoice);

    expect(result).toEqual(expectedResult(invoice));
    expect(result.xml).not.toBeNull();
  });

  it("withholds XML when buyer reference is missing (always validated as XRechnung)", () => {
    const invoice = clone(domesticSimple) as Invoice;
    delete invoice.buyerReference;

    const result = generateInvoiceXml(invoice);

    expect(result).toEqual(expectedResult(invoice));
    expect(result.xml).toBeNull();
    expect(result.issues.some((i) => i.code === "XRECHNUNG_BUYER_REFERENCE_REQUIRED")).toBe(true);
  });

  it("withholds XML for any other business-rule error", () => {
    const invoice = clone(reducedRate) as Invoice;
    // 15% is not a valid category 'S' rate (only 19% or 7% are allowed)
    invoice.lines[0]!.vatRate = 15;

    const result = generateInvoiceXml(invoice);

    expect(result).toEqual(expectedResult(invoice));
    expect(result.xml).toBeNull();
    expect(result.issues.some((i) => i.code === "VAT_RATE_INVALID_FOR_CATEGORY")).toBe(true);
  });

  it("does not let warnings block the XML", () => {
    // Cross-border invoice → PLACE_OF_SUPPLY_CROSS_BORDER warning, no errors.
    const invoice = intraEuSupply as Invoice;
    const result = generateInvoiceXml(invoice);

    expect(result).toEqual(expectedResult(invoice));
    expect(result.issues.some((i) => i.severity === "warning")).toBe(true);
    expect(result.issues.some((i) => i.severity === "error")).toBe(false);
    expect(result.xml).not.toBeNull();
  });
});

/**
 * Checks generateInvoiceXml() with every valid fixture.
 *
 * Every fixture must pass the business rules and return XML. This test runs without Java, so it
 * still runs when KoSIT and Mustang are unavailable.
 *
 * It also checks that generateInvoiceXml() returns toXRechnung()'s XML unchanged, which the KoSIT
 * and Mustang tests rely on.
 */
describe("generateInvoiceXml with all fixtures", () => {
  describe.each(allFixtures)("%s", (label, fixture) => {
    it("returns XML, with no error-severity issues", () => {
      const invoice = fixture as Invoice;
      const { xml, issues } = generateInvoiceXml(invoice);

      // Compared as a code list so a failure says *why* the XML was withheld.
      const errorCodes = issues.filter((i) => i.severity === "error").map((i) => i.code);
      expect(errorCodes, `${label}: business-rule errors withheld the XML`).toEqual([]);

      // KoSIT/Mustang tests rely on both paths producing the same XML.
      expect(xml).toBe(toXRechnung(invoice));
    });
  });
});
