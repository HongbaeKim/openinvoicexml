// Real KoSIT / Mustang / veraPDF runs (Java child processes), kept in one file so they run one
// after another: split across files, vitest ran them in parallel and the first JVM start in each
// file timed out. Each suite is skipped, not failed, when its tools or Java are missing.

import { describe, it, expect } from "vitest";

import { validateXmlExternally } from "./external-validation.js";
import { validateFileExternally } from "./external-validation-file.js";
import {
  BROKEN_XML,
  allValidatorsAvailable,
  ciiXml,
  encode,
  leftoverTempDirs,
  ran,
  ublXml,
  validatorsAvailable,
} from "./external-validation.test-helpers.js";
import { generateInvoiceXml } from "./browser.js";
import { toFacturXPdf, toHybridPdf } from "./hybrid-pdf.js";
import type { Invoice } from "../core/index.js";

import { domesticSimple } from "../fixtures/index.js";

describe("validateXmlExternally", () => {
  describe.skipIf(!validatorsAvailable())("with real KoSIT + Mustang", () => {
    it("passes both validators for the browser entry's own XML, sent as raw bytes", () => {
      const { xml } = generateInvoiceXml(domesticSimple as Invoice);
      if (xml === null) throw new Error("fixture unexpectedly withheld");

      const result = validateXmlExternally(encode(xml));

      expect(ran(result.kosit).valid).toBe(true);
      expect(ran(result.mustang).valid).toBe(true);
      expect(result.kositScenario).toBeDefined();
      expect(result.complianceIssues.filter((i) => i.severity === "error")).toEqual([]);
      // Non-error findings are still reported (KoSIT's BR-DE-TMP-32: no delivery date).
      expect(ran(result.kosit).issues.some((i) => i.source === "kosit")).toBe(true);
      expect(result.complianceIssues).toEqual([
        ...ran(result.kosit).issues,
        ...ran(result.mustang).issues,
      ]);
    }, 60000);

    it("fails both validators (ran: true, valid: false) for an invoice missing mandatory fields", () => {
      const before = leftoverTempDirs("external-validation-");

      const result = validateXmlExternally(BROKEN_XML);

      expect(ran(result.kosit).valid).toBe(false);
      expect(ran(result.mustang).valid).toBe(false);
      const errorSources = new Set(
        result.complianceIssues.filter((i) => i.severity === "error").map((i) => i.source),
      );
      expect([...errorSources].sort()).toEqual(["kosit", "mustang"]);
      // The KoSIT report is written into the same temp dir, so it's gone too.
      expect(leftoverTempDirs("external-validation-")).toEqual(before);
    }, 60000);

    it("still runs Mustang when KoSIT can't run", () => {
      const result = validateXmlExternally(BROKEN_XML, {
        kosit: { jarPath: "does-not-exist/validator.jar" },
      });

      expect(result.kosit).toMatchObject({ applicable: true, ran: false, valid: false });
      expect(ran(result.mustang).valid).toBe(false);
      expect(result.complianceIssues.every((i) => i.source === "mustang")).toBe(true);
    }, 60000);
  });
});

describe("validateFileExternally", () => {
  describe.skipIf(!allValidatorsAvailable())("with real KoSIT + Mustang + veraPDF", () => {
    it("passes a UBL XML file, with KoSIT's matched scenario", async () => {
      const result = await validateFileExternally(encode(ublXml));

      expect(result.status).toBe("PASS");
      expect(result.kositScenario).toBeDefined();
      expect(result.veraPdf.applicable).toBe(false);
    }, 120000);

    it("passes a CII XML file under KoSIT's XRechnung CII scenario", async () => {
      const result = await validateFileExternally(encode(ciiXml));

      expect(result.status).toBe("PASS");
      expect(result.kositScenario).toBe("EN16931 XRechnung (CII)");
    }, 120000);

    it("passes a UBL hybrid PDF: veraPDF on the PDF, KoSIT + Mustang on the extracted XML", async () => {
      const result = await validateFileExternally(await toHybridPdf(domesticSimple as Invoice));

      expect(result.status).toBe("PASS");
      expect(result.veraPdfProfile).toBe("PDF/A-3b validation profile");
      expect(ran(result.veraPdf).valid).toBe(true);
    }, 120000);

    it("passes a Factur-X PDF: veraPDF + Mustang on the PDF, KoSIT on the extracted CII", async () => {
      const pdf = await toFacturXPdf(domesticSimple as Invoice, { profile: "EN16931" });

      const result = await validateFileExternally(pdf);

      expect(result.status).toBe("PASS");
      expect(result.kositScenario).toBe("EN16931 (CII)");
    }, 120000);

    it("fails an XML with an external entity without resolving it, and cleans up", async () => {
      const before = leftoverTempDirs("validate-file-");
      const marker = "XXE_MARKER_NOT_RESOLVED";
      const xxe = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ubl:Invoice [ <!ENTITY xxe "${marker}"> <!ENTITY ext SYSTEM "file:///etc/hostname"> ]>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:ID>&xxe;&ext;</cbc:ID></ubl:Invoice>`;

      const result = await validateFileExternally(encode(xxe));

      expect(result.status).toBe("FAIL");
      expect(ran(result.kosit).valid).toBe(false);
      expect(ran(result.mustang).valid).toBe(false);
      // Mustang's "no DOCTYPE" rejection comes with a message, not an empty issue list.
      expect(ran(result.mustang).issues.length).toBeGreaterThan(0);
      const messages = result.complianceIssues.map((i) => i.message).join("\n");
      expect(messages).not.toContain(marker);
      expect(leftoverTempDirs("validate-file-")).toEqual(before);
    }, 120000);

    it("fails a UBL invoice missing mandatory fields", async () => {
      const result = await validateFileExternally(encode(BROKEN_XML));

      expect(result.status).toBe("FAIL");
      expect(result.fileFindings).toEqual([]);
      expect(ran(result.kosit).valid).toBe(false);
    }, 120000);
  });
});
