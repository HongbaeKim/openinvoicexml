import { describe, it, expect } from "vitest";

import { toXRechnung } from "./xrechnung.js";
import type { Invoice } from "../core/index.js";

import domesticSimple from "../fixtures/domestic-simple.invoice.json" with { type: "json" };
import domesticMultiLine from "../fixtures/domestic-multi-line.invoice.json" with { type: "json" };
import reducedRate from "../fixtures/reduced-rate.invoice.json" with { type: "json" };
import exempt from "../fixtures/exempt.invoice.json" with { type: "json" };
import zeroRated from "../fixtures/zero-rated.invoice.json" with { type: "json" };
import reverseCharge from "../fixtures/reverse-charge.invoice.json" with { type: "json" };

const fixtures: [string, unknown][] = [
  ["domestic-simple", domesticSimple],
  ["domestic-multi-line", domesticMultiLine],
  ["reduced-rate", reducedRate],
  ["exempt", exempt],
  ["zero-rated", zeroRated],
  ["reverse-charge", reverseCharge],
];

describe("toXRechnung", () => {
  describe.each(fixtures)("basic check: %s", (_label, rawFixture) => {
    it("produces valid XRechnung XML structure", () => {
      const invoice = rawFixture as Invoice;
      const xml = toXRechnung(invoice);

      expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
      expect(xml).toContain("<ubl:Invoice");
      expect(xml).toContain('xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"');
      expect(xml).toContain(
        'xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"',
      );
      expect(xml).toContain(
        'xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"',
      );
      expect(xml).toContain(`<cbc:ID>${invoice.id}</cbc:ID>`);
      expect(xml).toContain(`<cbc:IssueDate>${invoice.issueDate}</cbc:IssueDate>`);
      expect(xml).toContain(invoice.seller.name);
      expect(xml).toContain(invoice.buyer.name);
    });
  });

  describe("field-specific mapping (domestic-simple)", () => {
    const xml = toXRechnung(domesticSimple as unknown as Invoice);

    it("CustomizationID is the XRechnung 3.x string", () => {
      expect(xml).toContain(
        "<cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>",
      );
    });

    it("includes BuyerReference", () => {
      expect(xml).toContain("<cbc:BuyerReference>04011000-12345-03</cbc:BuyerReference>");
    });

    it("includes payment IBAN", () => {
      expect(xml).toContain("<cbc:ID>DE89370400440532013000</cbc:ID>");
    });

    // Just test fist <cac:TaxSubtotal>, </cac:TaxSubtotal>
    it("includes VAT category S and percent 19 in TaxSubtotal", () => {
      const start = xml.indexOf("<cac:TaxSubtotal>");
      const end = xml.indexOf("</cac:TaxSubtotal>") + "</cac:TaxSubtotal>".length;
      const subtotal = xml.slice(start, end);
      expect(subtotal).toContain("<cbc:ID>S</cbc:ID>");
      expect(subtotal).toContain("<cbc:Percent>19</cbc:Percent>");
    });

    it("includes invoiced quantity with unit code", () => {
      expect(xml).toContain('<cbc:InvoicedQuantity unitCode="HUR">8</cbc:InvoicedQuantity>');
    });

    it("TaxExclusiveAmount is 1000.00", () => {
      expect(xml).toContain(
        '<cbc:TaxExclusiveAmount currencyID="EUR">1000.00</cbc:TaxExclusiveAmount>',
      );
    });

    it("PayableAmount is 1190.00", () => {
      expect(xml).toContain('<cbc:PayableAmount currencyID="EUR">1190.00</cbc:PayableAmount>');
    });

    it("includes seller Contact (BG-6, required by BR-DE-2)", () => {
      const invoice = domesticSimple as unknown as Invoice;
      expect(xml).toContain(`<cbc:Telephone>${invoice.seller.contact!.telephone}</cbc:Telephone>`);
      expect(xml).toContain(
        `<cbc:ElectronicMail>${invoice.seller.contact!.email}</cbc:ElectronicMail>`,
      );
    });
  });

  describe("XML escaping", () => {
    it("escapes & and < in string fields", () => {
      const base = domesticSimple as unknown as Invoice;
      const invoice: Invoice = {
        ...base,
        seller: {
          ...base.seller,
          name: "A&B <GmbH>",
        },
      };
      const xml = toXRechnung(invoice);
      expect(xml).toContain("A&amp;B");
      expect(xml).toContain("&lt;GmbH&gt;");
      expect(xml).not.toContain("A&B <");
    });
  });
});
