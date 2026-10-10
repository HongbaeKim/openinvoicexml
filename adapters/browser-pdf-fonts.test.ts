import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PDFDocument } from "@cantoo/pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

import { domesticSimple } from "../fixtures/index.js";
import type { Invoice } from "../core/index.js";

// In-process tests for browser-pdf.ts's font loading (fetch, caching, retry, options.fonts). browser-pdf.test.ts
// runs the bundled entry in a child process, which v8 coverage cannot see, so the same code is exercised here.
// fetch is replaced with a stub that serves the DejaVu files from disk.

const FONT_DIR = join(dirname(fileURLToPath(import.meta.url)), "assets/fonts");
const regular = new Uint8Array(readFileSync(join(FONT_DIR, "DejaVuSans.ttf")));
const bold = new Uint8Array(readFileSync(join(FONT_DIR, "DejaVuSans-Bold.ttf")));
const invoice = domesticSimple as Invoice;

// browser-pdf.ts keeps the loaded fonts in a module variable, so each test imports a fresh copy.
async function freshModule(): Promise<typeof import("./browser-pdf.js")> {
  vi.resetModules();
  return import("./browser-pdf.js");
}

function serveFonts(): ReturnType<typeof vi.fn> {
  const fetchStub = vi.fn((url: URL) => {
    const bytes = String(url).endsWith("DejaVuSans-Bold.ttf") ? bold : regular;
    return Promise.resolve({
      ok: true,
      status: 200,
      arrayBuffer: (): Promise<ArrayBuffer> => Promise.resolve(bytes.buffer.slice(0)),
    });
  });
  vi.stubGlobal("fetch", fetchStub);
  return fetchStub;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browser-pdf font loading", () => {
  it("fetches both fonts once and reuses them for later calls", async () => {
    const fetchStub = serveFonts();
    const { toHybridPdf, toFacturXPdf } = await freshModule();
    const hybrid = await toHybridPdf(invoice);
    await toFacturXPdf(invoice);
    expect(fetchStub).toHaveBeenCalledTimes(2);
    expect(Buffer.from(hybrid.slice(0, 5)).toString("ascii")).toBe("%PDF-");
    const doc = await PDFDocument.load(hybrid);
    expect(doc.getAttachments().some((a) => a.name === "xrechnung.xml")).toBe(true);
  });

  it("does not fetch when options.fonts is given", async () => {
    const fetchStub = serveFonts();
    const { toHybridPdf } = await freshModule();
    await toHybridPdf(invoice, { fonts: { regular, bold } });
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("reports the HTTP status when a font cannot be loaded, and retries on the next call", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 404 })));
    const { toHybridPdf } = await freshModule();
    await expect(toHybridPdf(invoice)).rejects.toThrow(/Could not load font .*DejaVuSans.*HTTP 404/);

    // The failure was not cached: once the fonts are served, the same module works.
    serveFonts();
    const pdf = await toHybridPdf(invoice);
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
