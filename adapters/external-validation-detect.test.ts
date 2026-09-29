import { describe, it, expect } from "vitest";

import { detectInvoiceFormat } from "./external-validation-detect.js";
import { ciiXml, encode, ublXml } from "./external-validation.test-helpers.js";
import { toXRechnung } from "./xrechnung.js";
import { toHybridPdf } from "./hybrid-pdf.js";
import type { Invoice } from "../core/index.js";

import { creditNoteFull, domesticSimple } from "../fixtures/index.js";

//
// Test detectInvoiceFormat()
//         ↓
// UBL                 → UBL_XML
// UBL CreditNote      → UBL_XML
// CII                 → CII_XML
// UTF-8 / UTF-16      → correct XML type
// other XML           → XML_OTHER
// broken XML          → XML_MALFORMED
// PDF                 → PDF
// normal text         → UNKNOWN
// empty file          → UNKNOWN
// DOCTYPE / entity    → don't resolve it
// real hybrid PDF     → PDF

// description | file bytes | expected result

describe("detectInvoiceFormat", () => {
  it.each([
    [
      "UBL Invoice (prefixed root)", 
      encode(ublXml), 
      "UBL_XML",
    ],
    [
      "UBL CreditNote", 
      encode(toXRechnung(creditNoteFull as Invoice)), 
      "UBL_XML",
    ],
    [
      "CII", 
      encode(ciiXml), 
      "CII_XML"
    ],
    [
      "UBL with a default namespace",
      encode('<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"></Invoice>'),
      "UBL_XML",
    ],
    [
      "UBL with a UTF-8 BOM", 
      new Uint8Array([0xef, 0xbb, 0xbf, ...encode(ublXml)]), 
      "UBL_XML",
    ],
    [
      "UBL in UTF-16LE with a BOM",
      new Uint8Array([0xff, 0xfe, ...Buffer.from(ublXml, "utf16le")]),
      "UBL_XML",
    ],
    [
      "other XML", 
      encode('<?xml version="1.0"?><order xmlns="urn:x"/>'), 
      "XML_OTHER"
    ],
    [
      "a UBL root name in the wrong namespace",
      encode('<Invoice xmlns="urn:not-ubl"></Invoice>'),
      "XML_OTHER",
    ],
    [
      "truncated XML", 
      encode(ublXml.slice(0, ublXml.length / 2)), 
      "XML_MALFORMED"
    ],
    [
      "an unterminated comment", 
      encode("<!-- never closed <Invoice/>"), 
      "XML_MALFORMED"
    ],
    [
      "a broken root start tag", 
      encode("<Invoice xmlns=>"), 
      "XML_MALFORMED"
    ],
    [
      "a PDF header", 
      encode("%PDF-1.7\n..."), 
      "PDF"
    ],
    [
      "a PDF header after leading junk", 
      encode(`${" ".repeat(10)}junk\n%PDF-1.4\n`), 
      "PDF"
    ],
    [
      "plain text", 
      encode("hello"), 
      "UNKNOWN"
    ],
    [
      "an empty file", 
      new Uint8Array(), 
      "UNKNOWN"
    ],
  ] as const)("%s → %s", (_label, bytes, expected) => {
    expect(detectInvoiceFormat(bytes)).toBe(expected);
  });

  // Can someone put a dangerous DOCTYPE inside an XML file and trick our detector into reading a file from the server?
  // This general attack pattern is called XXE
  it("classifies by content and never resolves a DOCTYPE's entities", () => {
    const xxe = `<?xml version="1.0"?>
<!DOCTYPE ubl:Invoice [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"><cbc:ID>&xxe;</cbc:ID></ubl:Invoice>`;

    // Detection only reads the prolog and root tags; KoSIT and Mustang reject the DOCTYPE.
    expect(detectInvoiceFormat(encode(xxe))).toBe("UBL_XML");
  });

  // Generate a real OpenInvoiceXML hybrid PDF, give it to the detector, 
  // and make sure the detector recognizes it as a PDF.
  it("detects a generated hybrid PDF as PDF", async () => {
    expect(detectInvoiceFormat(await toHybridPdf(domesticSimple as Invoice))).toBe("PDF");
  });
});
