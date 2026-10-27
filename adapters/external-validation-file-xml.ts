// Validates an uploaded XML file: KoSIT and Mustang run, veraPDF does not apply. Node-only.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  kositScenarioField,
  runKositAttempt,
  runMustangAttempt,
} from "./external-validation.js";
import type { InvoiceFileFormat } from "./external-validation-detect.js";
import { finish, notApplicable } from "./external-validation-file-result.js";
import type {
  FileFinding,
  FileValidationOptions,
  FileValidationResult,
} from "./external-validation-file-types.js";

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
export function validateXmlFile(
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
