import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, afterAll } from "vitest";

import { runMustang, extractWithMustang } from "../engines/92.mustang.js";
import { toFacturXPdf } from "../../adapters/hybrid-pdf.js";
import { toCii } from "../../adapters/cii.js";
import type { Invoice } from "../../core/index.js";

import { allFixtures } from "../../fixtures/index.js";
import { requireValidators } from "./validator-availability.test-helpers.js";

const JAR_PATH = "tools/mustang/mustang-cli.jar";

/**
 * Tests toFacturXPdf() output using the real Mustang CLI.
 *
 * Factur-X/ZUGFeRD requires CII XML, not UBL.
 * Mustang validates the PDF directly without extracting the XML first.
 * This confirms that our CII adapter produces a valid Factur-X PDF.
 *
 * Mustang's XML extraction is also tested separately to verify
 * our extractEmbeddedXml() implementation.
 */
export function describeMustangFacturX(profile: "EN16931" | "XRECHNUNG"): void {
  const available = requireValidators(["Mustang"]);
  const workDir = mkdtempSync(join(tmpdir(), `mustang-facturx-${profile.toLowerCase()}-`));

  afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  describe.skipIf(!available)(`runMustang (Factur-X, toFacturXPdf(), profile ${profile})`, () => {
    describe.each(allFixtures)("%s", (label, fixture) => {
      it(`validates directly against the PDF with zero errors, and extracts byte-identical CII, profile ${profile}`, async () => {
        const invoice = fixture as Invoice;
        const expected = toCii(invoice, { profile });
        const slug = label.replace(/^\d+\.\s*/, "").replace(/\s*\(.*\)$/, "");
        const pdfPath = join(workDir, `facturx-${slug}-${profile}.pdf`);
        writeFileSync(pdfPath, await toFacturXPdf(invoice, { profile }));

        const [result] = runMustang([pdfPath], { jarPath: JAR_PATH });
        expect(result!.valid).toBe(true);
        expect(result!.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);

        const extracted = extractWithMustang(pdfPath, { jarPath: JAR_PATH });
        expect(extracted).toBe(expected);

        await new Promise((resolve) => setImmediate(resolve));
      }, 30000);
    });
  });
}
