# Examples

Two practical examples demonstrate how to generate electronic invoices with OpenInvoiceXML:

1. **Standard invoice:** A German B2B invoice with 19% VAT.
2. **Small-business invoice (§19 UStG):** An invoice without VAT under the German Kleinunternehmerregelung.

Both examples use the same invoice data model. OpenInvoiceXML can generate XRechnung XML, a PDF/A-3 with embedded XRechnung XML, or a Factur-X/ZUGFeRD PDF with embedded CII XML.

Install the library:

```bash
npm install openinvoicexml
```

For the complete function reference, see [API.md](API.md). For invoice fields and EN 16931 business terms, see [DATA-MODEL.md](DATA-MODEL.md).

---

## 1. A standard invoice

A German company bills another German company for consulting work at 19% VAT.

```ts
import { writeFileSync } from "node:fs";
import { generateInvoice } from "openinvoicexml/adapters";
import type { Invoice } from "openinvoicexml";

const invoice: Invoice = {
  id: "RE-2026-0042",
  typeCode: "380", // 380 = commercial invoice
  issueDate: "2026-06-09",
  dueDate: "2026-07-09",
  currencyCode: "EUR",
  businessProcessType: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
  buyerReference: "04011000-12345-03", // the Leitweg-ID or order reference your customer gave you

  seller: {
    name: "Max Mustermann GmbH",
    vatId: "DE123456789",
    address: {
      line1: "Unter den Linden 1",
      city: "Berlin",
      postalCode: "10117",
      countryCode: "DE",
    },
    electronicAddress: "rechnung@mustermann.example",
    electronicAddressSchemeId: "EM", // EM = e-mail
    contact: {
      name: "Buchhaltung",
      telephone: "+49 30 1234567",
      email: "buchhaltung@mustermann.example",
    },
  },
  buyer: {
    name: "Acme GmbH",
    vatId: "DE987654321",
    address: { line1: "Marienplatz 1", city: "München", postalCode: "80331", countryCode: "DE" },
    electronicAddress: "einkauf@acme.example",
    electronicAddressSchemeId: "EM",
  },

  lines: [
    {
      id: "1",
      name: "TypeScript Consulting",
      description: "Software architecture consulting, June 2026",
      quantity: 8,
      unitCode: "HUR", // HUR = hour
      unitPrice: 125.0,
      lineAmount: 1000.0, // quantity x unitPrice
      vatCategoryCode: "S", // S = standard rate
      vatRate: 19,
    },
  ],
  vatBreakdowns: [{ categoryCode: "S", rate: 19, taxableAmount: 1000.0, taxAmount: 190.0 }],

  taxExclusiveAmount: 1000.0,
  taxAmount: 190.0,
  taxInclusiveAmount: 1190.0,
  duePayableAmount: 1190.0,

  paymentMeans: {
    code: "58", // 58 = SEPA credit transfer
    iban: "DE89370400440532013000",
    accountName: "Max Mustermann GmbH",
    bic: "COBADEFFXXX",
  },
  note: "Zahlbar innerhalb von 30 Tagen nach Rechnungsdatum.",
};

const { xml, issues } = generateInvoice(invoice);

if (xml === null) {
  // At least one issue has severity "error": nothing was generated, do not send this invoice.
  for (const issue of issues) console.error(`${issue.code}: ${issue.message}`);
} else {
  writeFileSync("invoice.xml", xml);
  // Warnings do not block the XML, but are worth reading.
  for (const issue of issues) console.warn(`${issue.severity} ${issue.code}: ${issue.message}`);
}
```

What happens:

1. The structure is checked (required fields, formats, unknown properties).
2. The business rules run: the totals must add up, the VAT breakdown must match the lines, and
   XRechnung's mandatory fields must be present.
3. If nothing is an error, `xml` holds an XRechnung 3.0 UBL 2.1 document, ready to send.

The amounts are not calculated for you. Every total must match the lines to the cent, and a
mismatch comes back as an issue instead of silently corrected XML. The helpers `calculateLineNetAmount`,
`calculateVatAmount` and `sumAmounts` compute them with the engine's rounding; see
[`API.md`](API.md#amount-calculations--calculatelinenetamount-calculatevatamount-sumamounts).

To also run the official KoSIT validator on the result, run `make kosit-setup` once and call
`generateInvoice(invoice, { validateExternally: true })`; the findings come back in
`complianceIssues`. See [`API.md`](API.md#generateinvoiceinvoice-options--recommended-entry-point).

---

## 2. A small-business invoice (§19 UStG)

A freelancer who uses the Kleinunternehmerregelung does not charge VAT and must say so on the
invoice. Start from the invoice above and change the parts that differ:

```ts
const kleinunternehmer: Invoice = {
  ...invoice,
  id: "RE-2026-0051",
  seller: {
    name: "Anna Beispiel Webdesign",
    taxRegistrationId: "12/345/67890", // Steuernummer; there is no vatId
    identifier: { id: "12/345/67890" }, // BR-CO-26 needs a seller identifier too (see below)
    address: { line1: "Musterstraße 5", city: "Leipzig", postalCode: "04109", countryCode: "DE" },
    electronicAddress: "anna@beispiel-webdesign.example",
    electronicAddressSchemeId: "EM",
    contact: {
      name: "Anna Beispiel",
      telephone: "+49 341 1234567",
      email: "anna@beispiel-webdesign.example",
    },
  },
  buyer: {
    name: "Acme GmbH",
    address: { line1: "Marienplatz 1", city: "München", postalCode: "80331", countryCode: "DE" },
    electronicAddress: "einkauf@acme.example",
    electronicAddressSchemeId: "EM",
  },
  lines: [
    {
      id: "1",
      name: "Webdesign-Dienstleistung",
      quantity: 1,
      unitCode: "C62", // C62 = piece
      unitPrice: 800.0,
      lineAmount: 800.0,
      vatCategoryCode: "E", // E = exempt from VAT
      vatRate: 0,
    },
  ],
  vatBreakdowns: [
    {
      categoryCode: "E",
      rate: 0,
      taxableAmount: 800.0,
      taxAmount: 0.0,
      exemptionReason: "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",
    },
  ],
  taxExclusiveAmount: 800.0,
  taxAmount: 0.0,
  taxInclusiveAmount: 800.0,
  duePayableAmount: 800.0,
  paymentMeans: {
    code: "58",
    iban: "DE02120300000000202051",
    accountName: "Anna Beispiel",
    bic: "BYLADEM1001",
  },
  note: "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",
};

const result = generateInvoice(kleinunternehmer);
```

What is different from the standard invoice:

- **No VAT ID.** A §19 business has none, so the seller carries its Steuernummer as
  `taxRegistrationId` instead. That alone is not enough: rule BR-CO-26 also needs a seller
  identifier (`identifier`, `legalId` or `vatId`), and a Steuernummer in `taxRegistrationId` does not
  count. Repeating the Steuernummer in `identifier` is an accepted convention
  (see [`DATA-MODEL.md`](DATA-MODEL.md)); without it the result is `SELLER_IDENTIFIER_REQUIRED`.
- **Category `E` with an `exemptionReason`.** The reason text is what tells the recipient why no VAT
  is shown; it is required for category `E`.
- **Rate 0 and tax amount 0**, with `taxExclusiveAmount` equal to `taxInclusiveAmount`.

The result is read exactly like example 1: `result.xml` is the document, or `null` with the reasons
in `result.issues`. The same idea covers the other VAT categories (zero rate, intra-EU, reverse
charge, export); [`SUPPORTED_SCENARIOS.md`](SUPPORTED_SCENARIOS.md) lists them with example files.

---

## 3. A hybrid PDF

A hybrid PDF is a PDF/A-3 invoice people can read, with the XML embedded inside it so software can
read it too.

```ts
import { writeFileSync } from "node:fs";
import { generateHybridPdf, extractEmbeddedXml } from "openinvoicexml/adapters";

const { pdf, issues } = await generateHybridPdf(invoice);

if (pdf === null) {
  for (const issue of issues) console.error(`${issue.code}: ${issue.message}`);
} else {
  writeFileSync("invoice.pdf", pdf);

  // The embedded XML is the same document generateInvoice() returns.
  const embedded = await extractEmbeddedXml("invoice.pdf"); // "xrechnung.xml"
}
```

`generateHybridPdf()` runs the same checks as `generateInvoice()` before drawing anything, so
`pdf` is `null` for an invoice that would not pass.

This PDF embeds the XRechnung UBL file, which suits German public-sector and B2B partners that ask
for XRechnung. It is not a Factur-X/ZUGFeRD file. If your recipient needs Factur-X, use
`generateFacturXPdf(invoice, { profile: "EN16931" })` instead; the call and the result have the same
shape, and the embedded file is CII (`extractEmbeddedXml("invoice.pdf", "factur-x.xml")`). The
difference is explained in [`API.md`](API.md#generatehybridpdfinvoice-options--recommended-entry-point)
and [`LIMITATIONS.md`](LIMITATIONS.md).
