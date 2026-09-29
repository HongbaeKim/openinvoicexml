// Existing-file validation (uploads): detect the format from content, then validate the file
// exactly as given. Node-only, like external-validation.ts, whose runner helpers it reuses.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PDFDocument } from "@cantoo/pdf-lib";

import { runVeraPdf } from "../validators/engines/91.vera-pdf.js";
import {
  fromVeraPdfIssue,
  type ComplianceIssue,
} from "../validators/engines/99.compliance-issue.js";
import {
  attempt,
  issuesOf,
  kositScenarioField,
  runKositAttempt,
  runMustangAttempt,
  type ApplicableValidatorResult,
  type ExternalValidationOptions,
  type ExternalValidatorResult,
} from "./external-validation.js";
import { detectInvoiceFormat, type InvoiceFileFormat } from "./external-validation-detect.js";

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

type ValidatorSet = Pick<FileValidationResult, "kosit" | "mustang" | "veraPdf">;
type ResultBase = Omit<FileValidationResult, "status" | "complianceIssues" | keyof ValidatorSet>;
// A PDF attachment with its actual file bytes.
type PdfAttachment = PdfAttachmentSummary & { bytes: Uint8Array };


/**
 * Returns a validator result when that validator
 * does not apply to this file.
 */
function notApplicable(reason: string): ExternalValidatorResult {
  return {
    applicable: false,
    reason,
  };
}

/** KoSIT and Mustang both not applicable, for the same reason. */
function bothNotApplicable(reason: string): Pick<ValidatorSet, "kosit" | "mustang"> {
  return { kosit: notApplicable(reason), mustang: notApplicable(reason) };
}

/**
 * Decides the final PASS / FAIL / UNAVAILABLE status.
 */
function overallStatus(
  fileFindings: FileFinding[],
  validators: ExternalValidatorResult[],
): FileValidationStatus {
  // A file problem means FAIL.
  if (fileFindings.length > 0) {
    return "FAIL";
  }

  // Look only at validators that apply to this file.
  const applicableValidators = validators.filter(
    (validator) => validator.applicable,
  );

  // A validator ran and found a problem.
  const hasFailedValidator = applicableValidators.some(
    (validator) => validator.ran && !validator.valid,
  );

  if (hasFailedValidator) {
    return "FAIL";
  }

  // No validator applies.
  if (applicableValidators.length === 0) {
    return "UNAVAILABLE";
  }

  // A validator should run, but could not run.
  const hasUnavailableValidator = applicableValidators.some(
    (validator) => !validator.ran,
  );

  if (hasUnavailableValidator) {
    return "UNAVAILABLE";
  }

  // Everything that should run passed.
  return "PASS";
}

/**
 * Combines everything into the final validation result.
 */
function finish(base: ResultBase, validators: ValidatorSet): FileValidationResult {
  const { kosit, mustang, veraPdf } = validators;
  return {
    status: overallStatus(base.fileFindings, [kosit, mustang, veraPdf]),
    ...base,
    kosit,
    mustang,
    veraPdf,
    complianceIssues: [...issuesOf(kosit), ...issuesOf(mustang), ...issuesOf(veraPdf)],
  };
}

/**
 * Returns a result for a file that is not XML or PDF.
 * No validators run.
 */
function unsupportedResult(): FileValidationResult {
  const reason = "The file is neither XML nor PDF.";

  const validators = bothNotApplicable(reason);

  const result = finish(
    {
      detectedFormat: "UNKNOWN",
      fileFindings: [],
    },
    {
      kosit: validators.kosit,
      mustang: validators.mustang,
      veraPdf: notApplicable(reason),
    },
  );

  return {
    ...result,
    status: "UNSUPPORTED",
  };
}

/**
 * Returns a problem if the XML is invalid
 * or is not an invoice.
 */
function xmlFileFindings(
  format: InvoiceFileFormat,
): FileFinding[] {
  if (format === "XML_MALFORMED") {
    return [
      {
        code: "XML_MALFORMED",
        message: "Not well-formed XML.",
      },
    ];
  }

  if (format === "XML_OTHER") {
    return [
      {
        code: "XML_NOT_AN_INVOICE",
        message: "XML, but not a UBL or CII invoice.",
      },
    ];
  }

  // No problem.
  return [];
}

/**
 * Validates an XML file.
 *
 * KoSIT and Mustang check the XML.
 * veraPDF does not run because this is not a PDF.
 */
function validateXmlFile(
  tempDir: string,
  bytes: Uint8Array,
  format: InvoiceFileFormat,
  options: FileValidationOptions,
): FileValidationResult {
  // Save the XML.
  const xmlPath = join(tempDir, "upload.xml");
  writeFileSync(xmlPath, bytes);

  // Check with KoSIT.
  const kositCheck = runKositAttempt(xmlPath, options);

  // Check with Mustang.
  const mustangCheck = runMustangAttempt(xmlPath, options);

  // Check for basic file problems.
  const fileFindings = xmlFileFindings(format);

  // veraPDF is only for PDFs.
  const veraPdfCheck = notApplicable(
    "The file is XML, not a PDF.",
  );

  return finish(
    {
      detectedFormat: format,
      mustangTarget: "XML",
      ...kositScenarioField(kositCheck),
      fileFindings,
    },
    {
      kosit: kositCheck.result,
      mustang: mustangCheck,
      veraPdf: veraPdfCheck,
    },
  );
}

/**
 * Reads all files attached inside the PDF.
 * Throws an error if the PDF cannot be read.
 */
async function readPdfAttachments(
  bytes: Uint8Array,
): Promise<PdfAttachment[]> {
  const pdf = await PDFDocument.load(bytes, {
    updateMetadata: false,
  });

  const attachments = pdf.getAttachments();

  return attachments.map((attachment) => {
    const result: PdfAttachment = {
      name: attachment.name,
      detectedFormat: detectInvoiceFormat(attachment.data),
      bytes: attachment.data,
    };

    // Add MIME type if it exists.
    if (attachment.mimeType !== undefined) {
      result.mediaType = attachment.mimeType;
    }

    // Add attachment relationship if it exists.
    if (attachment.afRelationship !== undefined) {
      result.relationship = String(attachment.afRelationship);
    }

    return result;
  });
}

/**
 * Checks that the PDF has exactly one invoice XML.
 *
 * Returns a problem if:
 * - there is no invoice XML
 * - there is more than one invoice XML
 *
 * Returns undefined if everything is OK.
 */
function embeddedInvoiceProblem(
  invoices: EmbeddedInvoiceXml[],
  attachments: PdfAttachmentSummary[],
): { finding: FileFinding; reason: string } | undefined {
  // No invoice XML.
  if (invoices.length === 0) {
    const attachmentNames = attachments.map(
      (attachment) => attachment.name,
    );

    const names =
      attachmentNames.length > 0
        ? attachmentNames.join(", ")
        : "none";

    return {
      finding: {
        code: "PDF_NO_EMBEDDED_INVOICE_XML",
        message: `No embedded invoice XML found. Attachments: ${names}.`,
      },
      reason: "The PDF has no embedded invoice XML to validate.",
    };
  }

  // More than one invoice XML.
  if (invoices.length > 1) {
    const invoiceNames = invoices.map(
      (invoice) => invoice.name,
    );

    return {
      finding: {
        code: "PDF_MULTIPLE_EMBEDDED_INVOICE_XML",
        message:
          `Several embedded invoice XMLs found (${invoiceNames.join(", ")}). ` +
          "None was picked for validation.",
      },
      reason:
        "The PDF has several embedded invoice XMLs; none was picked.",
    };
  }

  // Exactly one invoice XML. Everything is OK.
  return undefined;
}

/**
 * Tries to run veraPDF on one PDF.
 *
 * The PDF/A flavour is detected from the PDF's own metadata, so an upload is checked against
 * the profile it claims. Falls back to PDF/A-3b (what Factur-X and hybrid PDFs require) when
 * the metadata names none.
 * Returns the validation result and, if veraPDF parsed the PDF, the profile it applied.
 */
function runVeraPdfAttempt(
  pdfPath: string,
  options: FileValidationOptions,
): { result: ApplicableValidatorResult; profile?: string } {
  // veraPDF may or may not report a profile.
  let profile: string | undefined;

  const result = attempt(() => {
    const results = runVeraPdf([pdfPath], {
      ...options.veraPdf,
      flavour: "0",
      defaultFlavour: "3b",
    });

    // We checked only one file, so get the first result.
    const veraPdfResult = results[0];

    if (!veraPdfResult) {
      throw new Error("veraPDF returned no result.");
    }

    // Remember the profile veraPDF applied.
    profile = veraPdfResult.profileName;

    // Convert veraPDF's issues to our standard ComplianceIssue format.
    const issues = veraPdfResult.issues.map((issue) => {
      return fromVeraPdfIssue(issue);
    });

    return {
      valid: veraPdfResult.valid,
      issues: issues,
    };
  });

  if (profile === undefined) {
    return { result: result };
  }

  return { result: result, profile: profile };
}

/**
 * Validates a PDF invoice.
 *
 * 1. Save and check the PDF.
 * 2. Read its attachments.
 * 3. Find the invoice XML.
 * 4. Check the invoice with KoSIT and Mustang.
 */
async function validatePdfFile(
  tempDir: string,
  bytes: Uint8Array,
  options: FileValidationOptions,
): Promise<FileValidationResult> {
  // Save the PDF.
  const pdfPath = join(tempDir, "upload.pdf");
  writeFileSync(pdfPath, bytes);

  // Check the PDF with veraPDF.
  const veraPdfCheck = runVeraPdfAttempt(pdfPath, options);
  const veraPdf = veraPdfCheck.result;
  const profile = veraPdfCheck.profile;

  const pdfInfo = {
    detectedFormat: "PDF" as const,
    ...(profile !== undefined ? { veraPdfProfile: profile } : {}),
  };

  // Read the files inside the PDF.
  let attachments: PdfAttachment[];

  try {
    attachments = await readPdfAttachments(bytes);
  } catch (error) {
    let errorMessage = "";

    if (error instanceof Error) {
      errorMessage = ` ${error.message}`;
    }

    return finish(
      {
        ...pdfInfo,
        fileFindings: [
          {
            code: "PDF_UNREADABLE",
            message: `Not a readable PDF.${errorMessage}`,
          },
        ],
      },
      {
        ...bothNotApplicable(
          "No embedded invoice XML could be read from the PDF.",
        ),
        veraPdf,
      },
    );
  }

  // Get simple information about each attachment.
  const attachmentSummaries = attachments.map(
    ({ bytes: _, ...summary }) => summary,
  );

  // Find UBL or CII invoice XML.
  const invoiceXmlFiles = attachments.filter(
    (attachment): attachment is EmbeddedInvoiceXml => {
      return (
        attachment.detectedFormat === "UBL_XML" ||
        attachment.detectedFormat === "CII_XML"
      );
    },
  );

  // There must be exactly one invoice XML.
  const problem = embeddedInvoiceProblem(
    invoiceXmlFiles,
    attachmentSummaries,
  );

  if (problem) {
    return finish(
      {
        ...pdfInfo,
        attachments: attachmentSummaries,
        fileFindings: [problem.finding],
      },
      {
        ...bothNotApplicable(problem.reason),
        veraPdf,
      },
    );
  }

  // Save the invoice XML.
  const invoiceXml = invoiceXmlFiles[0]!;
  const xmlPath = join(tempDir, "embedded.xml");

  writeFileSync(xmlPath, invoiceXml.bytes);

  // Check if this is a CII invoice.
  const isCii = invoiceXml.detectedFormat === "CII_XML";

  // KoSIT always checks the extracted XML.
  const kositCheck = runKositAttempt(xmlPath, options);

  // Mustang checks:
  // CII → PDF
  // UBL → extracted XML
  let mustangPath = xmlPath;
  let pdfKind: "FACTURX_CII" | "UBL_HYBRID" = "UBL_HYBRID";
  let mustangTarget: "PDF" | "EXTRACTED_XML" = "EXTRACTED_XML";

  if (isCii) {
    mustangPath = pdfPath;
    pdfKind = "FACTURX_CII";
    mustangTarget = "PDF";
  }

  const mustangCheck = runMustangAttempt(mustangPath, options);

  // Return all validation results.
  return finish(
    {
      ...pdfInfo,
      pdfKind,
      attachments: attachmentSummaries,
      embedded: invoiceXml,
      mustangTarget,
      ...kositScenarioField(kositCheck),
      fileFindings: [],
    },
    {
      kosit: kositCheck.result,
      mustang: mustangCheck,
      veraPdf,
    },
  );
}

/**
 * Validates an uploaded invoice file exactly as it is.
 * The file type is detected from its content, not its name or MIME type.
 *
 * - UBL/CII XML: checked with KoSIT and Mustang.
 * - Invalid XML: reports the file problem and also runs KoSIT and Mustang.
 * - PDF: checked with veraPDF. The embedded invoice XML is found and checked too.
 * - Unsupported file: nothing runs.
 *
 * If a PDF has no invoice XML, or more than one, it reports a file problem.
 * Validators that cannot run are reported instead of throwing an error.
 * Temporary files are automatically deleted afterwards.
 */
export async function validateFileExternally(
  bytes: Uint8Array,
  options: FileValidationOptions = {},
): Promise<FileValidationResult> {
  const format = detectInvoiceFormat(bytes);

  if (format === "UNKNOWN") {
    return unsupportedResult();
  }

  const tempDir = mkdtempSync(join(tmpdir(), "validate-file-"));

  try {
    if (format === "PDF") {
      return await validatePdfFile(tempDir, bytes, options);
    }

    return validateXmlFile(tempDir, bytes, format, options);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
