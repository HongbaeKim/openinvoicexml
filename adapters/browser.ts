// Browser-safe entry point (`openinvoicexml/browser`).
//
// Everything reachable from this file must run without Node.js: no node:* imports, no
// unapproved packages, no fileURLToPath()/fs-based loading. browser.test.ts walks the whole
// import graph from here and enforces that ("browser entry policy").
//
// Node-only features (hybrid PDF, KoSIT/veraPDF/Mustang) stay in `openinvoicexml/adapters`.
// The dependency points one way: generate-invoice.ts imports this file, never the reverse.

import type { Invoice } from "../core/index.js";
import {
  validateBusinessRules,
  type ValidationIssue,
} from "../validators/engines/02.business-rules.js";
import { toXRechnung } from "./xrechnung.js";

export { toXRechnung } from "./xrechnung.js";
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
