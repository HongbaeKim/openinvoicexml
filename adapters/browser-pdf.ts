// Hybrid PDFs in the browser (`openinvoicexml/browser`). Same layout and the same embedded XML as the Node
// entry points in hybrid-pdf.ts: this file only supplies the fonts, by fetching them next to this module.
// Everything reachable from here must stay Node-free (see the browser entry policy in browser.test.ts).

import type { Invoice } from "../core/index.js";
import {
  buildFacturXPdf,
  buildHybridPdf,
  type HybridPdfOptions,
  type PdfFontBytes,
} from "./hybrid-pdf-core.js";

export type { HybridPdfOptions, PdfFontBytes } from "./hybrid-pdf-core.js";

export interface BrowserPdfOptions extends HybridPdfOptions {
  /**
   * DejaVu Sans regular + bold TrueType bytes. Optional: by default they are fetched from
   * `assets/fonts/` next to this module (`new URL(..., import.meta.url)`), which Vite, webpack and
   * esbuild bundle as assets. Pass this if your build setup cannot do that, or to avoid the request.
   */
  fonts?: PdfFontBytes;
}

let defaultFonts: Promise<PdfFontBytes> | undefined;

async function fetchBytes(url: URL): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load font ${url.pathname}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

/** Fetches the bundled fonts once per page; a failed load is not cached, so the next call retries. */
function loadDefaultFonts(): Promise<PdfFontBytes> {
  defaultFonts ??= Promise.all([
    fetchBytes(new URL("./assets/fonts/DejaVuSans.ttf", import.meta.url)),
    fetchBytes(new URL("./assets/fonts/DejaVuSans-Bold.ttf", import.meta.url)),
  ]).then(
    ([regular, bold]) => ({ regular, bold }),
    (error: unknown) => {
      defaultFonts = undefined;
      throw error;
    },
  );
  return defaultFonts;
}

async function fontsFor(options: BrowserPdfOptions): Promise<PdfFontBytes> {
  return options.fonts ?? loadDefaultFonts();
}

/**
 * Generates a human-readable PDF/A-3 invoice with the XRechnung UBL XML embedded (hybrid PDF), entirely
 * in the browser. Like `generateInvoiceXml()`, run `validateBusinessRules(invoice, "XRECHNUNG")` first:
 * this function does not check the invoice.
 */
export async function toHybridPdf(invoice: Invoice, options: BrowserPdfOptions = {}): Promise<Uint8Array> {
  return buildHybridPdf(invoice, await fontsFor(options), options);
}

/** Factur-X/ZUGFeRD variant: embeds CII XML. Same browser rules as `toHybridPdf()`. */
export async function toFacturXPdf(invoice: Invoice, options: BrowserPdfOptions = {}): Promise<Uint8Array> {
  return buildFacturXPdf(invoice, await fontsFor(options), options);
}
