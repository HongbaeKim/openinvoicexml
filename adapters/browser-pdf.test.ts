import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PDFDocument, parsePDFAConformanceFromXmp } from "@cantoo/pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// vite is vitest's own bundler (already installed with it); used here to bundle like an app would.
import { build } from "vite";

import { domesticSimple, manyLines, umlautName } from "../fixtures/index.js";
import type { Invoice } from "../core/index.js";
import { toCii } from "./cii.js";
import { toXRechnung } from "./xrechnung.js";

// Runs `openinvoicexml/browser`'s PDF functions the way a web app does: the entry is bundled for the browser
// (so `new URL("./assets/fonts/...", import.meta.url)` becomes a font asset) and the bundle runs in a fresh
// Node process with the Node-only globals (Buffer, process, require, module) removed. Fonts are fetched,
// not read from disk. A Node-only call in the PDF path fails there. Real browsers are not part of this suite.

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "browser-pdf-"));
const bundle = join(dir, "browser-bundle.mjs");

const INVOICES: [string, Invoice][] = [
  ["domestic-simple", domesticSimple as Invoice],
  ["umlauts", umlautName as Invoice],
  ["many lines (second page)", manyLines as Invoice],
];

// Test runner that acts like a browser: it loads the bundled code,
// fetches the inlined fonts, and removes Node-only features.
const RUNNER = `
import { readFileSync } from "node:fs";

// Read the test invoices and locate the bundled browser entry.
// example) node runner.mjs input.json browser-bundle.mjs
const input = JSON.parse(readFileSync(process.argv[2], "utf8"));
const bundlePath = process.argv[3];

// Keep stdout before removing the global Node \`process\`.
const stdout = process.stdout;
const write = (text) => stdout.write(text);

// Browser-like fetch for Vite-inlined font assets.
// Only data: URLs are allowed, so the test cannot read fonts from disk or network.
globalThis.fetch = async (url) => {
  const match = /^data:[^,]*;base64,(.*)$/s.exec(String(url));
  if (!match) {
    throw new Error(
      "test fetch only serves inlined data: URLs, got " + String(url).slice(0, 80)
    );
  }

  const bytes = Uint8Array.from(
    atob(match[1]),
    (c) => c.charCodeAt(0)
  );

  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => bytes.buffer,
  };
};

// Load the Vite-built openinvoicexml/browser bundle.
const lib = await import(bundlePath);

// Remove Node-only globals before calling the browser PDF API.
// If the PDF implementation accidentally depends on one of these, the test should fail.
for (const name of [
  "Buffer",
  "process",
  "require",
  "module",
  "__dirname",
  "__filename",
]) {
  Object.defineProperty(globalThis, name, {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

// Convert generated PDF bytes to Base64 so they can be returned as JSON.
const b64 = (bytes) =>
  btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));

// Generate both browser PDFs for every fixture.
const out = [];
for (const { name, invoice } of input) {
  out.push({
    name,
    hybrid: b64(await lib.toHybridPdf(invoice)),
    facturx: b64(
      await lib.toFacturXPdf(invoice, { profile: "EN16931" })
    ),
  });
}

// Invalid font bytes must fail instead of silently creating a broken PDF.
const rejected = await lib
  .toHybridPdf(input[0].invoice, {
    fonts: {
      regular: new Uint8Array(1),
      bold: new Uint8Array(1),
    },
  })
  .then(
    () => false,
    () => true
  );

out.push({
  name: "bad-fonts-reject",
  rejected,
});

// Send the results back to the parent Vitest process.
write(JSON.stringify(out));
`;

let results: { 
  name: string; 
  hybrid?: string; 
  facturx?: string; 
  rejected?: boolean;
}[] = [];

beforeAll(async () => {
  await build({
    root: REPO_ROOT,
    logLevel: "silent",
    configFile: false,
    // Inline the fonts as data: URLs so the child's fetch() can load them without a server.
    build: {
      write: true,
      outDir: dir,
      emptyOutDir: false,
      assetsInlineLimit: Number.MAX_SAFE_INTEGER,
      // Don't compress the JavaScript so the test can read it and check for Node-only code.
      minify: false,
      target: "es2022",
      lib: { entry: join(REPO_ROOT, "adapters/browser.ts"), formats: ["es"], fileName: () => "browser-bundle.mjs" },
    },
  });
  const input = join(dir, "input.json");
  writeFileSync(input, JSON.stringify(INVOICES.map(([name, invoice]) => ({ name, invoice }))));
  const runner = join(dir, "runner.mjs");
  writeFileSync(runner, RUNNER);
  const stdout = execFileSync(process.execPath, [runner, input, bundle], { maxBuffer: 64 * 1024 * 1024 });
  results = JSON.parse(stdout.toString("utf8")) as typeof results;
}, 120_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

// Convert Base64 to bytes for PDFDocument.load().
function bytesOf(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

describe("openinvoicexml/browser PDF (bundled for the browser, Node globals removed)", () => {
  it("the bundle contains no Node-only code", () => {
    // Drop comment lines first: pdf-lib's doc comments show `import fs from 'fs'` examples.
    const text = readFileSync(bundle, "utf8")
      .split("\n")
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
      .join("\n");
    expect(text).not.toMatch(/(?:from|import|require\()\s*\(?\s*["'](?:node:)?(?:fs|url|path|os|module|crypto|stream|zlib|buffer)["']/);
    expect(text).not.toMatch(/fileURLToPath/);
  });

  it.each(INVOICES.map(([name]) => name))("toHybridPdf(%s): PDF/A-3b with the same XRechnung XML as Node", async (name) => {
    const invoice = INVOICES.find(([n]) => n === name)![1];
    const bytes = bytesOf(results.find((r) => r.name === name)!.hybrid!);
    expect(Buffer.from(bytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    // at least one page
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    const xml = doc.getAttachments().find((a) => a.name === "xrechnung.xml");
    expect(xml).toBeDefined();
    expect(Buffer.from(xml!.data).toString("utf8")).toBe(toXRechnung(invoice));
    const xmp = Buffer.from(bytes).toString("latin1");
    expect(parsePDFAConformanceFromXmp(xmp)).toMatchObject({ part: 3, level: "B" });
  });

  it.each(INVOICES.map(([name]) => name))("toFacturXPdf(%s): embeds factur-x.xml equal to toCii()", async (name) => {
    const invoice = INVOICES.find(([n]) => n === name)![1];
    const bytes = bytesOf(results.find((r) => r.name === name)!.facturx!);
    const doc = await PDFDocument.load(bytes);
    const xml = doc.getAttachments().find((a) => a.name === "factur-x.xml");
    expect(xml).toBeDefined();
    expect(Buffer.from(xml!.data).toString("utf8")).toBe(toCii(invoice, { profile: "EN16931" }));
  });

  it("the fonts are really embedded (umlauts need DejaVu, not a standard font)", () => {
    const bytes = bytesOf(results.find((r) => r.name === "umlauts")!.hybrid!);
    const text = Buffer.from(bytes).toString("latin1");
    expect(text).toContain("DejaVuSans");
  });

  it("rejects unusable font bytes instead of producing a broken PDF", () => {
    expect(results.find((r) => r.name === "bad-fonts-reject")!.rejected).toBe(true);
  });
});
