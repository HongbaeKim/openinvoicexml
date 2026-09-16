import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Invoice } from "../core/index.js";
import { validateBusinessRules, type ValidationIssue } from "../validators/engines/02.business-rules.js";
import { runKosit } from "../validators/engines/90.kosit.js";
import type { KositIssue } from "../validators/engines/90.kosit.js";
import {
  fromValidationIssue,
  fromKositIssue,
  type ComplianceIssue,
} from "../validators/engines/99.compliance-issue.js";
import { toXRechnung } from "./xrechnung.js";
import { toCii } from "./cii.js";
import {
  toHybridPdf,
  toFacturXPdf,
  type HybridPdfOptions,
  type EInvoiceProfile,
} from "./hybrid-pdf.js";

/**
 * XML generation is synchronous because it only builds strings in memory.
 * PDF generation is asynchronous because pdf-lib uses Promises for PDF creation and saving.
 *
 * generateInvoiceDocument() is always async so callers can use the same API for every format.
 */

  export interface GenerateInvoiceOptions {
  /**
   * Optional: runs the real KoSIT validator on the generated XML.
   *
   * KoSIT issues are converted to ComplianceIssue and added together
   * with this project's own validation issues.
   *
   * This is off by default.
   * So `generateInvoice(invoice)` can still run normally without
   * Java or KoSIT installed.
   *
   * External validation is only run when it is requested.
   */
  validateExternally?: boolean;
}

export interface GenerateInvoiceResult {
  /** The generated XRechnung XML, or null if business-rule validation found an error. */
  xml: string | null;
  /** All business-rule issues found, including non-blocking warnings. */
  issues: ValidationIssue[];
  /**
   * Contains this project's own issues plus KoSIT issues from the generated XML.
   *
   * All issues are converted to ComplianceIssue.
   *
   * This field only exists when `validateExternally: true` is used.
   * If external validation is not requested, the field is not included.
   *
   * This helps tell the difference between:
   * - external validation was not run
   * - external validation was run and found no issues
   */
  complianceIssues?: ComplianceIssue[];
}

/**
 * Saves the XML to a temporary file and checks it with KoSIT.
 *
 * The temporary file is deleted after the check,
 * even if KoSIT returns an error.
 *
 * This only runs when `validateExternally` is enabled.
 */
function runKositAgainstXml(xml: string): KositIssue[] {
  const dir = mkdtempSync(join(tmpdir(), "generate-invoice-kosit-"));
  try {
    const xmlPath = join(dir, "invoice.xml");
    writeFileSync(xmlPath, xml, "utf8");
    return runKosit([xmlPath])[0]?.issues ?? [];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Checks the invoice against EN 16931 rules.
 * If there are no errors, it creates XRechnung XML.
 * generateInvoice() = validate first, then convert to XML.
 * toXRechnung() can still be used directly if validation is done separately.
 */
export function generateInvoice(
  invoice: Invoice,
  options: GenerateInvoiceOptions = {},
): GenerateInvoiceResult {
  // Always genuine XRechnung UBL regardless of any profile option, so validate as XRECHNUNG.
  const issues = validateBusinessRules(invoice, "XRECHNUNG");
  const hasErrors = issues.some((issue) => issue.severity === "error");
  const xml = hasErrors ? null : toXRechnung(invoice);

  if (!options.validateExternally) return { xml, issues };

  const complianceIssues = issues.map(fromValidationIssue);
  if (xml !== null) {
    complianceIssues.push(...runKositAgainstXml(xml).map(fromKositIssue));
  }
  return { xml, issues, complianceIssues };
}

export interface GenerateCiiResult {
  /** The generated CII XML, or null if business-rule validation found an error. */
  xml: string | null;
  /** All business-rule issues found, including non-blocking warnings. */
  issues: ValidationIssue[];
}

/**
 * Same gate as generateInvoice(), but for toCii(). toCii() is synchronous like toXRechnung(), so
 * this mirrors generateInvoice()'s signature, not generateHybridPdf()'s.
 */
export function generateCii(
  invoice: Invoice,
  options: { profile?: EInvoiceProfile } = {},
): GenerateCiiResult {
  // toCii() genuinely varies its guideline claim by profile, so validate against the same
  // profile it will generate (mirroring toCii's own "EN16931" default).
  const issues = validateBusinessRules(invoice, options.profile);
  const hasErrors = issues.some((issue) => issue.severity === "error");
  return { xml: hasErrors ? null : toCii(invoice, options), issues };
}

export interface GenerateHybridPdfResult {
  /** The generated hybrid PDF bytes, or null if business-rule validation found an error. */
  pdf: Uint8Array | null;
  /** All business-rule issues found, including non-blocking warnings. */
  issues: ValidationIssue[];
}

/**
 * Same validation check as generateInvoice(), but for hybrid PDFs.
 *
 * This is a separate function because toHybridPdf() is async,
 * while toXRechnung() and generateInvoice() are sync.
 *
 * We keep them separate so the existing sync functions do not need to change.
 */

export async function generateHybridPdf(
  invoice: Invoice,
  options: HybridPdfOptions = {},
): Promise<GenerateHybridPdfResult> {
  // toHybridPdf() always uses XRechnung UBL.
  // options.profile does not change the output.
  // So always validate it as XRECHNUNG.
  const issues = validateBusinessRules(invoice, "XRECHNUNG");
  const hasErrors = issues.some((issue) => issue.severity === "error");
  return { pdf: hasErrors ? null : await toHybridPdf(invoice, options), issues };
}

export interface GenerateFacturXPdfResult {
  /** The generated Factur-X/ZUGFeRD hybrid PDF bytes, or null if business-rule validation found an error. */
  pdf: Uint8Array | null;
  /** All validation issues, including warnings. */
  issues: ValidationIssue[];
}

/** Same validation check as generateHybridPdf(), but for toFacturXPdf(). */
export async function generateFacturXPdf(
  invoice: Invoice,
  options: HybridPdfOptions = {},
): Promise<GenerateFacturXPdfResult> {
  // toFacturXPdf() genuinely varies its CII conformance claim by profile, so validate against
  // the same profile it will generate (mirroring toFacturXPdf's own "EN16931" default).
  const issues = validateBusinessRules(invoice, options.profile);
  const hasErrors = issues.some((issue) => issue.severity === "error");
  return { pdf: hasErrors ? null : await toFacturXPdf(invoice, options), issues };
}

/** Which invoice/PDF format generateInvoiceDocument() should produce. */
export type InvoiceOutputFormat =
  "XRECHNUNG_UBL" | "XRECHNUNG_CII" | "FACTURX_EN16931" | "FACTURX_XRECHNUNG";

export interface GenerateInvoiceDocumentOptions {
  format: InvoiceOutputFormat;
}

export type GenerateInvoiceDocumentResult =
  | {
      format: "XRECHNUNG_UBL";
      contentType: "xml";
      content: string | null;
      issues: ValidationIssue[];
    }
  | {
      format: "XRECHNUNG_CII";
      contentType: "xml";
      content: string | null;
      issues: ValidationIssue[];
    }
  | {
      format: "FACTURX_EN16931";
      contentType: "pdf";
      content: Uint8Array | null;
      issues: ValidationIssue[];
    }
  | {
      format: "FACTURX_XRECHNUNG";
      contentType: "pdf";
      content: Uint8Array | null;
      issues: ValidationIssue[];
    };

/**
 * Routes to the per-format recommended entry point (generateInvoice/generateCii/
 * generateFacturXPdf) based on options.format, re-keyed to a uniform content/contentType shape.
 * Always async — two of the four branches are internally sync, but one uniform Promise-returning
 * signature is simpler for a caller that doesn't know a format's sync/async-ness ahead of time
 * (e.g. a UI format picker). Purely a composition layer: no invoice-mapping logic lives here,
 * only routing to the existing per-format functions above.
 */
export async function generateInvoiceDocument(
  invoice: Invoice,
  options: GenerateInvoiceDocumentOptions,
): Promise<GenerateInvoiceDocumentResult> {
  switch (options.format) {
    case "XRECHNUNG_UBL": {
      const { xml, issues } = generateInvoice(invoice);
      return { format: "XRECHNUNG_UBL", contentType: "xml", content: xml, issues };
    }
    case "XRECHNUNG_CII": {
      const { xml, issues } = generateCii(invoice, { profile: "XRECHNUNG" });
      return { format: "XRECHNUNG_CII", contentType: "xml", content: xml, issues };
    }
    case "FACTURX_EN16931": {
      const { pdf, issues } = await generateFacturXPdf(invoice, { profile: "EN16931" });
      return { format: "FACTURX_EN16931", contentType: "pdf", content: pdf, issues };
    }
    case "FACTURX_XRECHNUNG": {
      const { pdf, issues } = await generateFacturXPdf(invoice, { profile: "XRECHNUNG" });
      return { format: "FACTURX_XRECHNUNG", contentType: "pdf", content: pdf, issues };
    }
  }
}
