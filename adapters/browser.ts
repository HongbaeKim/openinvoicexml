// Browser-safe entry point (`openinvoicexml/browser`).
//
// Everything reachable from this file must run without Node.js: no node:* imports, no
// unapproved packages, no fileURLToPath()/fs-based loading. browser.test.ts walks the whole
// import graph from here and enforces that ("browser entry policy").
//
// Hybrid PDFs are available here too (browser-pdf.ts); only KoSIT/veraPDF/Mustang stay Node-only in
// `openinvoicexml/adapters`.
// The dependency points one way: generate-invoice.ts imports this file, never the reverse.

import type { Invoice } from "../core/index.js";
import {
  validateBusinessRules,
  type ValidationIssue,
} from "../validators/engines/02.business-rules.js";
import type { EInvoiceProfile } from "../core/types/profile.js";
import { toXRechnung } from "./xrechnung.js";
import { toCii } from "./cii.js";

export { toXRechnung } from "./xrechnung.js";
export { toCii } from "./cii.js";
export { toHybridPdf, toFacturXPdf } from "./browser-pdf.js";
export type { BrowserPdfOptions, HybridPdfOptions, PdfFontBytes } from "./browser-pdf.js";
export { validateBusinessRules } from "../validators/engines/02.business-rules.js";
export type { Invoice } from "../core/index.js";
export type { ValidationIssue } from "../validators/types.js";
export type { EInvoiceProfile } from "../core/types/profile.js";

export interface GenerateInvoiceXmlResult {
  /** The generated XRechnung XML, or null if business-rule validation found an error. */
  xml: string | null;
  /** All business-rule issues found, including non-blocking warnings. */
  issues: ValidationIssue[];
}

/**
 * Checks the invoice against EN 16931 + XRechnung business rules.
 * If there are no errors, it creates XRechnung UBL XML.
 * Warnings never block the XML; they are returned in `issues`.
 */
export function generateInvoiceXml(invoice: Invoice): GenerateInvoiceXmlResult {
  // Always genuine XRechnung UBL, so validate as XRECHNUNG.
  const issues = validateBusinessRules(invoice, "XRECHNUNG");
  const hasErrors = issues.some((issue) => issue.severity === "error");
  return { xml: hasErrors ? null : toXRechnung(invoice), issues };
}

export interface GenerateCiiResult {
  /** The generated CII XML, or null if schema (Node only) or business-rule validation found an error. */
  xml: string | null;
  /** All issues found, including non-blocking warnings. */
  issues: ValidationIssue[];
}

/**
 * Checks the invoice against the business rules of the requested profile (default "EN16931",
 * same as toCii()). If there are no errors, it creates CII XML.
 * Warnings never block the XML; they are returned in `issues`.
 *
 * This is the business-rule gate only. The Node entry point's generateCii() also runs the JSON
 * Schema check first (it needs AJV, which is Node-only); this function assumes a structurally
 * valid `Invoice`, like generateInvoiceXml().
 */
export function generateCii(
  invoice: Invoice,
  options: { profile?: EInvoiceProfile } = {},
): GenerateCiiResult {
  const issues = validateBusinessRules(invoice, options.profile);
  const hasErrors = issues.some((issue) => issue.severity === "error");
  return { xml: hasErrors ? null : toCii(invoice, options), issues };
}
