// Types for existing-file validation (uploads). The public ones are re-exported from
// external-validation-file.ts; ValidatorSet, ResultBase and PdfAttachment are shared by the
// sibling modules only and are not part of any public entry point.

import type { ComplianceIssue } from "../validators/engines/99.compliance-issue.js";
import type { ExternalValidationOptions, ExternalValidatorResult } from "./external-validation.js";
import type { InvoiceFileFormat } from "./external-validation-detect.js";

/** Overall result for an uploaded file. The caller's hash check is not part of it (see below). */
export type FileValidationStatus = "PASS" | "FAIL" | "UNAVAILABLE" | "UNSUPPORTED";

/** A problem with the file itself, found before or instead of a validator. Always a FAIL. */
export interface FileFinding {
  code:
    | "XML_MALFORMED"
    | "XML_NOT_AN_INVOICE"
    | "PDF_UNREADABLE"
    | "PDF_NO_EMBEDDED_INVOICE_XML"
    | "PDF_MULTIPLE_EMBEDDED_INVOICE_XML";
  message: string;
}

/** An attachment found in an uploaded PDF (metadata only). */
export interface PdfAttachmentSummary {
  /** The name as stored in the PDF. Display only. */
  name: string;
  /** The embedded file's `/Subtype`, if present. */
  mediaType?: string;
  /** The file spec's `/AFRelationship` (e.g. Data, Alternative, Source), if present. */
  relationship?: string;
  /** detectInvoiceFormat() of the attachment's own bytes. */
  detectedFormat: InvoiceFileFormat;
}

/** The one invoice XML embedded in an uploaded PDF — the one that gets validated. */
export interface EmbeddedInvoiceXml extends PdfAttachmentSummary {
  detectedFormat: "UBL_XML" | "CII_XML";
  /** The exact embedded bytes, as stored (after stream decoding), never re-encoded. */
  bytes: Uint8Array;
}

export interface FileValidationResult {
  /**
   * PASS only if there are no file findings and every applicable validator ran and is valid.
   * FAIL if there is a file finding or an applicable validator ran and rejected the file.
   * UNAVAILABLE if nothing failed but an applicable validator couldn't run — never show that
   * as a pass. UNSUPPORTED if the file is neither XML nor PDF (nothing was validated).
   * Validators that aren't applicable never affect it.
   *
   * The caller's SHA-256 round-trip check isn't included: a hash mismatch must never be shown
   * as PASS either.
   */
  status: FileValidationStatus;
  detectedFormat: InvoiceFileFormat;
  /** For a PDF with exactly one embedded invoice XML: CII → Factur-X/ZUGFeRD, UBL → a hybrid
   * PDF with embedded UBL, which must never be labeled Factur-X/ZUGFeRD. */
  pdfKind?: "FACTURX_CII" | "UBL_HYBRID";
  /** Every attachment found in a PDF, invoice or not. */
  attachments?: PdfAttachmentSummary[];
  embedded?: EmbeddedInvoiceXml;
  /** What Mustang was run on: the uploaded XML, the PDF itself (Factur-X/CII) or the extracted
   * XML (UBL hybrid, which Mustang rejects as a PDF because Factur-X is CII-only). */
  mustangTarget?: "XML" | "PDF" | "EXTRACTED_XML";
  kositScenario?: string;
  /** The PDF/A profile veraPDF applied, detected from the PDF's own metadata. */
  veraPdfProfile?: string;
  fileFindings: FileFinding[];
  kosit: ExternalValidatorResult;
  mustang: ExternalValidatorResult;
  veraPdf: ExternalValidatorResult;
  /** KoSIT, then Mustang, then veraPDF findings. */
  complianceIssues: ComplianceIssue[];
}

// Extra options used when validating a file.
export interface FileValidationOptions extends ExternalValidationOptions {
  veraPdf?: {
    cliPath?: string;
  };
}

export type ValidatorSet = Pick<FileValidationResult, "kosit" | "mustang" | "veraPdf">;
export type ResultBase = Omit<FileValidationResult, "status" | "complianceIssues" | keyof ValidatorSet>;
// A PDF attachment with its actual file bytes.
export type PdfAttachment = PdfAttachmentSummary & { bytes: Uint8Array };
