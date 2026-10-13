import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "@cantoo/pdf-lib";

import type { Invoice } from "../core/index.js";
import {
  buildFacturXPdf,
  buildHybridPdf,
  type HybridPdfOptions,
  type PdfFontBytes,
} from "./hybrid-pdf-core.js";

// Node entry points for the hybrid PDFs. The layout lives in hybrid-pdf-core.ts, which is browser-safe;
// this file only adds what needs Node: reading the fonts from disk and extractEmbeddedXml().
// The browser counterpart is browser-pdf.ts (`openinvoicexml/browser`).

export { wrappedLineCount, pageNumberLabel } from "./hybrid-pdf-core.js";
export type { EInvoiceProfile, HybridPdfOptions } from "./hybrid-pdf-core.js";

const FONT_DIR = fileURLToPath(new URL("./assets/fonts/", import.meta.url));

function readFonts(): PdfFontBytes {
  return {
    regular: readFileSync(`${FONT_DIR}DejaVuSans.ttf`),
    bold: readFileSync(`${FONT_DIR}DejaVuSans-Bold.ttf`),
  };
}

/**
 * Generates a human-readable PDF/A-3 invoice from an Invoice, with PDF/A-3b conformance basics
 * applied and the XRechnung UBL XML embedded as an associated file (AFRelationship=Alternative).
 */
export function toHybridPdf(invoice: Invoice, options: HybridPdfOptions = {}): Promise<Uint8Array> {
  return buildHybridPdf(invoice, readFonts(), options);
}

/**
 * Generates a human-readable PDF/A-3 invoice with the CII invoice XML embedded as a
 * Factur-X/ZUGFeRD hybrid document. See `buildFacturXPdf()` in hybrid-pdf-core.ts.
 */
export function toFacturXPdf(invoice: Invoice, options: HybridPdfOptions = {}): Promise<Uint8Array> {
  return buildFacturXPdf(invoice, readFonts(), options);
}

/**
 * Extracts and decodes an XML attachment (`xrechnung.xml` by default, or `"factur-x.xml"` for
 * `toFacturXPdf()` output) from a generated hybrid PDF on disk. Throws if the PDF has no such
 * attachment.
 */
export async function extractEmbeddedXml(
  pdfPath: string,
  attachmentName = "xrechnung.xml",
): Promise<string> {
  const bytes = readFileSync(pdfPath);
  const doc = await PDFDocument.load(bytes);
  const attachment = doc.getAttachments().find((a) => a.name === attachmentName);
  if (!attachment) {
    throw new Error(`No ${attachmentName} attachment found in ${pdfPath}`);
  }
  return Buffer.from(attachment.data).toString("utf8");
}
