import { PDFDocument } from "@cantoo/pdf-lib";
import { describe, it, expect } from "vitest";

import { validateFileExternally } from "./external-validation-file.js";
import {
  NO_VALIDATORS,
  ciiXml,
  encode,
  leftoverTempDirs,
  ublXml,
} from "./external-validation.test-helpers.js";
import { toFacturXPdf, toHybridPdf } from "./hybrid-pdf.js";
import type { Invoice } from "../core/index.js";

import { domesticSimple } from "../fixtures/index.js";

/** A PDF with the given attachments (no PDF/A claim; enough for attachment handling). */
async function pdfWith(
  attachments: { name: string; bytes: Uint8Array; mimeType?: string }[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage();
  for (const { name, bytes, mimeType } of attachments) {
    await doc.attach(bytes, name, mimeType === undefined ? {} : { mimeType });
  }
  return doc.save();
}

describe("validateFileExternally", () => {
  // These run everywhere: every validator points at a missing jar/CLI, so no JVM starts.
  describe("without validators (format, findings, attachment handling)", () => {
    it("reports a file that is neither XML nor PDF as UNSUPPORTED, with nothing applicable", async () => {
      const before = leftoverTempDirs("validate-file-");

      const result = await validateFileExternally(encode("hello"), NO_VALIDATORS);

      expect(result.status).toBe("UNSUPPORTED");
      expect(result.detectedFormat).toBe("UNKNOWN");
      for (const validator of [result.kosit, result.mustang, result.veraPdf]) {
        expect(validator.applicable).toBe(false);
      }
      expect(leftoverTempDirs("validate-file-")).toEqual(before);
    });

    it("reports XML whose validators can't run as UNAVAILABLE, and veraPDF as not applicable", async () => {
      const result = await validateFileExternally(encode(ublXml), NO_VALIDATORS);

      expect(result.status).toBe("UNAVAILABLE");
      expect(result.detectedFormat).toBe("UBL_XML");
      expect(result.mustangTarget).toBe("XML");
      expect(result.kosit).toMatchObject({ applicable: true, ran: false });
      expect(result.mustang).toMatchObject({ applicable: true, ran: false });
      expect(result.veraPdf).toEqual({ applicable: false, reason: "The file is XML, not a PDF." });
      expect(result.fileFindings).toEqual([]);
    });

    it.each([
      ["truncated XML", ublXml.slice(0, 200), "XML_MALFORMED"],
      ["non-invoice XML", '<?xml version="1.0"?><order xmlns="urn:x"/>', "XML_NOT_AN_INVOICE"],
    ])(
      "reports %s as a FAIL file finding (never UNSUPPORTED), even when validators can't run",
      async (_label, xml, code) => {
        const result = await validateFileExternally(encode(xml), NO_VALIDATORS);

        expect(result.status).toBe("FAIL");
        expect(result.fileFindings.map((f) => f.code)).toEqual([code]);
      },
    );

    it("reports an unreadable PDF as a FAIL file finding", async () => {
      const result = await validateFileExternally(encode("%PDF-1.4 garbage"), NO_VALIDATORS);

      expect(result.status).toBe("FAIL");
      expect(result.detectedFormat).toBe("PDF");
      expect(result.fileFindings.map((f) => f.code)).toEqual(["PDF_UNREADABLE"]);
      expect(result.kosit.applicable).toBe(false);
      expect(result.mustang.applicable).toBe(false);
      expect(result.veraPdf).toMatchObject({ applicable: true, ran: false });
    });

    it("reports a PDF without an invoice XML as a FAIL file finding that lists its attachments", async () => {
      const pdf = await pdfWith([
        { name: "notes.txt", bytes: encode("hi"), mimeType: "text/plain" },
      ]);

      const result = await validateFileExternally(pdf, NO_VALIDATORS);

      expect(result.status).toBe("FAIL");
      expect(result.fileFindings.map((f) => f.code)).toEqual(["PDF_NO_EMBEDDED_INVOICE_XML"]);
      expect(result.fileFindings[0]!.message).toContain("notes.txt");
      expect(result.attachments).toEqual([
        { name: "notes.txt", mediaType: "text/plain", detectedFormat: "UNKNOWN" },
      ]);
      expect(result.embedded).toBeUndefined();
    });

    it("finds the invoice XML by content, not by attachment name", async () => {
      const pdf = await pdfWith([{ name: "whatever-name.bin", bytes: encode(ciiXml) }]);

      const result = await validateFileExternally(pdf, NO_VALIDATORS);

      expect(result.fileFindings).toEqual([]);
      expect(result.pdfKind).toBe("FACTURX_CII");
      expect(result.embedded?.name).toBe("whatever-name.bin");
    });

    it("never picks one of several embedded invoice XMLs", async () => {
      const pdf = await pdfWith([
        { name: "a.xml", bytes: encode(ublXml) },
        { name: "b.xml", bytes: encode(ciiXml) },
      ]);

      const result = await validateFileExternally(pdf, NO_VALIDATORS);

      expect(result.status).toBe("FAIL");
      expect(result.fileFindings.map((f) => f.code)).toEqual(["PDF_MULTIPLE_EMBEDDED_INVOICE_XML"]);
      expect(result.embedded).toBeUndefined();
      expect(result.kosit.applicable).toBe(false);
    });

    it("labels a UBL hybrid PDF as UBL_HYBRID (never Factur-X) and keeps the exact embedded bytes", async () => {
      const pdf = await toHybridPdf(domesticSimple as Invoice);

      const result = await validateFileExternally(pdf, NO_VALIDATORS);

      expect(result.pdfKind).toBe("UBL_HYBRID");
      expect(result.mustangTarget).toBe("EXTRACTED_XML");
      // toHybridPdf() attaches it as text/xml with AFRelationship Alternative.
      expect(result.embedded).toMatchObject({
        name: "xrechnung.xml",
        mediaType: "text/xml",
        relationship: "Alternative",
        detectedFormat: "UBL_XML",
      });
      expect(new TextDecoder().decode(result.embedded!.bytes)).toBe(ublXml);
      expect(result.status).toBe("UNAVAILABLE");
    });

    it("labels a Factur-X PDF as FACTURX_CII", async () => {
      const pdf = await toFacturXPdf(domesticSimple as Invoice, { profile: "EN16931" });

      const result = await validateFileExternally(pdf, NO_VALIDATORS);

      expect(result.pdfKind).toBe("FACTURX_CII");
      expect(result.mustangTarget).toBe("PDF");
      expect(result.embedded).toMatchObject({ name: "factur-x.xml", detectedFormat: "CII_XML" });
    });
  });
});
