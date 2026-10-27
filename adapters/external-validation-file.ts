// Existing-file validation (uploads): detect the format from content, then validate the file
// exactly as given. Node-only, like external-validation.ts, whose runner helpers it reuses.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { detectInvoiceFormat } from "./external-validation-detect.js";
import { validatePdfFile } from "./external-validation-file-pdf.js";
import { unsupportedResult } from "./external-validation-file-result.js";
import type { FileValidationOptions, FileValidationResult } from "./external-validation-file-types.js";
import { validateXmlFile } from "./external-validation-file-xml.js";

export type {
  EmbeddedInvoiceXml,
  FileFinding,
  FileValidationOptions,
  FileValidationResult,
  FileValidationStatus,
  PdfAttachmentSummary,
} from "./external-validation-file-types.js";

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
