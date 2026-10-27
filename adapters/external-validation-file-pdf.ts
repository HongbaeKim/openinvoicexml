// Validates an uploaded PDF: veraPDF on the PDF, then KoSIT and Mustang on the one embedded
// invoice XML. Node-only.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { PDFDocument } from "@cantoo/pdf-lib";

import { runVeraPdf } from "../validators/engines/91.vera-pdf.js";
import { fromVeraPdfIssue } from "../validators/engines/99.compliance-issue.js";
import {
  kositScenarioField,
  runKositAttempt,
  runMustangAttempt,
  tryRunValidator,
  type ApplicableValidatorResult,
} from "./external-validation.js";
import { detectInvoiceFormat } from "./external-validation-detect.js";
import { bothNotApplicable, finish } from "./external-validation-file-result.js";
import type {
  EmbeddedInvoiceXml,
  FileFinding,
  FileValidationOptions,
  FileValidationResult,
  PdfAttachment,
  PdfAttachmentSummary,
} from "./external-validation-file-types.js";

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

  const result = tryRunValidator(() => {
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
export async function validatePdfFile(
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
