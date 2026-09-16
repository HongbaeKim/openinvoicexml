import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, it, expect, afterAll } from "vitest";

import {
  generateInvoice,
  generateHybridPdf,
  generateFacturXPdf,
  generateCii,
  generateInvoiceDocument,
  type InvoiceOutputFormat,
} from "./generate-invoice.js";
import { toXRechnung } from "./xrechnung.js";
import { toCii } from "./cii.js";
import { extractEmbeddedXml } from "./hybrid-pdf.js";
import type { Invoice } from "../core/index.js";

import { allFixtures, reducedRate, domesticSimple } from "../fixtures/index.js";

/** Deep-clones a fixture so mutations in one test don't leak into others. */
function clone<T>(fixture: T): T {
  return JSON.parse(JSON.stringify(fixture)) as T;
}

/** Same availability check `validators/test/90.kosit.test.ts` uses — the `{ validateExternally:
 * true }` tests below shell out to the real KoSIT jar, so they're skipped, not failed, when it
 * (or Java) isn't set up locally. */
function kositAvailable(): boolean {
  const javaBin = existsSync("tools/jre/bin/java") ? "tools/jre/bin/java" : "java";
  if (!existsSync("tools/kosit/validator.jar") || !existsSync("tools/kosit/config/scenarios.xml")) {
    return false;
  }
  try {
    execFileSync(javaBin, ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe("generateInvoice", () => {
  describe.each(allFixtures)("valid fixtures (%s)", (_label, fixture) => {
    it("generates XML with no error-severity issues", () => {
      const result = generateInvoice(fixture as Invoice);

      expect(result.issues.filter((issue) => issue.severity === "error")).toEqual([]);
      expect(result.xml).not.toBeNull();
      expect(result.xml!.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    });
  });

  it("withholds XML and reports issues for an invoice with a business-rule error", () => {
    const invoice = clone(reducedRate) as Invoice;
    // 15% is not a valid category 'S' rate (only 19% or 7% are allowed)
    invoice.lines[0]!.vatRate = 15;

    const result = generateInvoice(invoice);

    expect(result.xml).toBeNull();
    expect(result.issues.some((issue) => issue.severity === "error")).toBe(true);
  });

  it("withholds XML when buyer reference is missing (always validated as XRechnung)", () => {
    const invoice = clone(domesticSimple) as Invoice;
    delete invoice.buyerReference;

    const result = generateInvoice(invoice);

    expect(result.xml).toBeNull();
    expect(result.issues.some((i) => i.code === "XRECHNUNG_BUYER_REFERENCE_REQUIRED")).toBe(true);
  });

  it("omits complianceIssues entirely on the default call (opt-in, not just empty)", () => {
    const result = generateInvoice(domesticSimple as Invoice);
    expect(result.complianceIssues).toBeUndefined();
  });

  describe.skipIf(!kositAvailable())("{ validateExternally: true }", () => {
    it(
      "merges real KoSIT findings (as ComplianceIssue) alongside this project's own issues",
      () => {
        const result = generateInvoice(domesticSimple as Invoice, { validateExternally: true });

        expect(result.xml).not.toBeNull();
        expect(result.complianceIssues).toBeDefined();
        // This fixture has no issues from our own validator.
        // If there were any, they would have source: "business-rules".
        // KoSIT still reports BR-DE-TMP-32 because this fixture
        // does not include a delivery date.
        const bySource = new Set(result.complianceIssues!.map((i) => i.source));
        expect(bySource.has("kosit")).toBe(true);
        expect(
          result.complianceIssues!.every((i) => i.source === "business-rules" || i.source === "kosit"),
        ).toBe(true);
      },
      20000,
    );

    it(
      "still reports a KoSIT-found error even when this project's own validator misses it",
      () => {
        // Fixture 41 passes our own business-rule checks.
        // But KoSIT would fail if the seller had none of BT-29, BT-30, or BT-31.
        // We test that KoSIT-only error directly instead of keeping a broken fixture just for this test.
        const invoice = clone(domesticSimple) as Invoice;
        delete invoice.seller.vatId;
        delete invoice.seller.legalId;

        const result = generateInvoice(invoice, { validateExternally: true });

        expect(result.xml).not.toBeNull();
        expect(result.issues.filter((i) => i.severity === "error")).toEqual([]);
        const kositErrors = result.complianceIssues!.filter(
          (i) => i.source === "kosit" && i.severity === "error",
        );
        expect(kositErrors.some((i) => i.code === "BR-CO-26")).toBe(true);
      },
      20000,
    );
  });
});

describe("generateHybridPdf", () => {
  it("generates a PDF with no error-severity issues", async () => {
    const result = await generateHybridPdf(domesticSimple as Invoice);

    expect(result.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(result.pdf).not.toBeNull();
    expect(result.pdf).toBeInstanceOf(Uint8Array);
  });

  it("forwards the profile option through to toHybridPdf without disturbing the error gate", async () => {
    const result = await generateHybridPdf(domesticSimple as Invoice, { profile: "XRECHNUNG" });

    expect(result.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(result.pdf).not.toBeNull();
  });

  it("withholds the PDF and reports issues for an invoice with a business-rule error", async () => {
    const invoice = clone(reducedRate) as Invoice;
    // 15% is not a valid category 'S' rate (only 19% or 7% are allowed)
    invoice.lines[0]!.vatRate = 15;

    const result = await generateHybridPdf(invoice);

    expect(result.pdf).toBeNull();
    expect(result.issues.some((issue) => issue.severity === "error")).toBe(true);
  });

  it("withholds the PDF when buyer reference is missing, even with profile: EN16931 (embedded UBL is always XRechnung)", async () => {
    const invoice = clone(domesticSimple) as Invoice;
    delete invoice.buyerReference;

    const result = await generateHybridPdf(invoice, { profile: "EN16931" });

    expect(result.pdf).toBeNull();
    expect(result.issues.some((i) => i.code === "XRECHNUNG_BUYER_REFERENCE_REQUIRED")).toBe(true);
  });
});

describe("generateFacturXPdf", () => {
  it("generates a PDF with no error-severity issues", async () => {
    const result = await generateFacturXPdf(domesticSimple as Invoice);

    expect(result.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(result.pdf).not.toBeNull();
    expect(result.pdf).toBeInstanceOf(Uint8Array);
  });

  it("forwards the profile option through to toFacturXPdf without disturbing the error gate", async () => {
    const result = await generateFacturXPdf(domesticSimple as Invoice, { profile: "XRECHNUNG" });

    expect(result.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(result.pdf).not.toBeNull();
  });

  it("withholds the PDF and reports issues for an invoice with a business-rule error", async () => {
    const invoice = clone(reducedRate) as Invoice;
    // 15% is not a valid category 'S' rate (only 19% or 7% are allowed)
    invoice.lines[0]!.vatRate = 15;

    const result = await generateFacturXPdf(invoice);

    expect(result.pdf).toBeNull();
    expect(result.issues.some((issue) => issue.severity === "error")).toBe(true);
  });

  it("still generates a PDF when buyer reference is missing under the default EN16931 profile", async () => {
    const invoice = clone(domesticSimple) as Invoice;
    delete invoice.buyerReference;

    const result = await generateFacturXPdf(invoice);

    expect(result.issues.some((i) => i.code === "XRECHNUNG_BUYER_REFERENCE_REQUIRED")).toBe(false);
    expect(result.pdf).not.toBeNull();
  });

  it("withholds the PDF when buyer reference is missing and profile is XRECHNUNG", async () => {
    const invoice = clone(domesticSimple) as Invoice;
    delete invoice.buyerReference;

    const result = await generateFacturXPdf(invoice, { profile: "XRECHNUNG" });

    expect(result.pdf).toBeNull();
    expect(result.issues.some((i) => i.code === "XRECHNUNG_BUYER_REFERENCE_REQUIRED")).toBe(true);
  });
});

describe("generateCii", () => {
  describe.each(allFixtures)("valid fixtures (%s)", (_label, fixture) => {
    it("generates XML with no error-severity issues", () => {
      const result = generateCii(fixture as Invoice);

      expect(result.issues.filter((issue) => issue.severity === "error")).toEqual([]);
      expect(result.xml).not.toBeNull();
      expect(result.xml!.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    });
  });

  it("forwards the profile option through to toCii without disturbing the error gate", () => {
    const result = generateCii(domesticSimple as Invoice, { profile: "XRECHNUNG" });

    expect(result.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(result.xml).not.toBeNull();
  });

  it("withholds XML and reports issues for an invoice with a business-rule error", () => {
    const invoice = clone(reducedRate) as Invoice;
    // 15% is not a valid category 'S' rate (only 19% or 7% are allowed)
    invoice.lines[0]!.vatRate = 15;

    const result = generateCii(invoice);

    expect(result.xml).toBeNull();
    expect(result.issues.some((issue) => issue.severity === "error")).toBe(true);
  });

  // Under EN16931, the XRechnung buyer-reference rule does not apply.
  it("still generates XML when buyer reference is missing under the default EN16931 profile", () => {
    const invoice = clone(domesticSimple) as Invoice;
    delete invoice.buyerReference;

    const result = generateCii(invoice);

    expect(result.issues.some((i) => i.code === "XRECHNUNG_BUYER_REFERENCE_REQUIRED")).toBe(false);
    expect(result.xml).not.toBeNull();
  });

  // Under XRECHNUNG, the buyer reference is required.
  it("withholds XML when buyer reference is missing and profile is XRECHNUNG", () => {
    const invoice = clone(domesticSimple) as Invoice;
    delete invoice.buyerReference;

    const result = generateCii(invoice, { profile: "XRECHNUNG" });

    expect(result.xml).toBeNull();
    expect(result.issues.some((i) => i.code === "XRECHNUNG_BUYER_REFERENCE_REQUIRED")).toBe(true);
  });
});

describe("generateInvoiceDocument", () => {
  describe.each([
    ["XRECHNUNG_UBL", "xml"],
    ["XRECHNUNG_CII", "xml"],
    ["FACTURX_EN16931", "pdf"],
    ["FACTURX_XRECHNUNG", "pdf"],
  ] as const)("format %s", (format, contentType) => {
    it("generates content with no error-severity issues", async () => {
      const result = await generateInvoiceDocument(domesticSimple as Invoice, { format });

      expect(result.format).toBe(format);
      expect(result.contentType).toBe(contentType);
      expect(result.content).not.toBeNull();
      expect(result.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    });

    it("withholds content and reports issues for an invoice with a business-rule error", async () => {
      const invoice = clone(reducedRate) as Invoice;
      // 15% is not a valid category 'S' rate (only 19% or 7% are allowed)
      invoice.lines[0]!.vatRate = 15;

      const result = await generateInvoiceDocument(invoice, { format });

      expect(result.content).toBeNull();
      expect(result.issues.some((issue) => issue.severity === "error")).toBe(true);
    });
  });

  // Already always Xrechnung
  it("XRECHNUNG_UBL content is identical to toXRechnung()'s direct output", async () => {
    const result = await generateInvoiceDocument(domesticSimple as Invoice, {
      format: "XRECHNUNG_UBL",
    });

    expect(result.content).toBe(toXRechnung(domesticSimple as Invoice));
  });

  it("XRECHNUNG_CII content is identical to toCii({ profile: 'XRECHNUNG' })'s direct output", async () => {
    const result = await generateInvoiceDocument(domesticSimple as Invoice, {
      format: "XRECHNUNG_CII",
    });

    expect(result.content).toBe(toCii(domesticSimple as Invoice, { profile: "XRECHNUNG" }));
  });

  // Two generated PDFs may have different internal PDF data,
  // even when their visible content is the same.
  // So compare the embedded CII XML instead of comparing the raw PDF bytes.
  const facturXDir = mkdtempSync(join(tmpdir(), "generate-invoice-document-facturx-test-"));
  afterAll(() => {
    // Delete facturXDir completely.
    // If it is already gone, that's okay.
    rmSync(facturXDir, { recursive: true, force: true });
  });

  it.each(["EN16931", "XRECHNUNG"] as const)(
    "FACTURX_%s embeds CII XML identical to toCii({ profile: '%s' })'s direct output",
    async (profile) => {
      const format: InvoiceOutputFormat =
        profile === "EN16931" ? "FACTURX_EN16931" : "FACTURX_XRECHNUNG";
      const result = await generateInvoiceDocument(domesticSimple as Invoice, { format });
      if (result.contentType !== "pdf" || result.content === null) {
        throw new Error("expected a non-null pdf content");
      }

      const pdfPath = join(facturXDir, `${profile}.pdf`);
      writeFileSync(pdfPath, result.content);
      const extracted = await extractEmbeddedXml(pdfPath, "factur-x.xml");

      expect(extracted).toBe(toCii(domesticSimple as Invoice, { profile }));
    },
  );

  it("narrows content to Uint8Array when contentType is 'pdf'", async () => {
    const format: InvoiceOutputFormat = "FACTURX_XRECHNUNG";
    const result = await generateInvoiceDocument(domesticSimple as Invoice, { format });

    if (result.contentType === "pdf") {
      expect(result.content).toBeInstanceOf(Uint8Array);
    } else {
      throw new Error("expected contentType to be 'pdf'");
    }
  });
});
