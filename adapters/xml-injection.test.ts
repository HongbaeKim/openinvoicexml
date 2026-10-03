import { describe, it, expect } from "vitest";

import { toXRechnung } from "./xrechnung.js";
import { toCii } from "./cii.js";
import type { Invoice } from "../core/index.js";

import { domesticSimple, creditNoteFull } from "../fixtures/index.js";

/**
 * Tests that the XML serializers safely escape input.
 *
 * These tests call toXRechnung()/toCii() directly, bypassing schema validation.
 * This makes sure the serializers are still safe even if invalid input reaches them.
 *
 * The test payload contains XML-sensitive characters:
 * `"` can break out of an attribute, `<`/`>` can create XML elements,
 * and `&` can start an XML entity.
 */

// A  "  <i/>   &
// │  │    │    │
// │  │    │    └─ dangerous XML character
// │  │    └────── possible XML element
// │  └─────────── can break an XML attribute
// └────────────── normal text
const PAYLOAD = 'A"<i/>&';
const ESCAPED = "A&quot;&lt;i/&gt;&amp;";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** A domestic-simple invoice with the optional blocks these tests need filled in. */
function baseInvoice(): Invoice {
  const invoice = clone(domesticSimple);
  return {
    ...invoice,
    seller: { ...invoice.seller, identifier: { id: "S-1", schemeId: "0204" } },
    buyer: { ...invoice.buyer, identifier: { id: "B-1", schemeId: "0204" } },
    delivery: {
      actualDeliveryDate: "2026-06-09",
      deliverTo: { city: "Berlin", postalCode: "10117", countryCode: "DE" },
    },
    precedingInvoiceReference: { id: "RE-1", issueDate: "2026-05-01" },
    allowancesCharges: [
      {
        isCharge: false,
        amount: 10,
        reason: "Rabatt",
        vatCategoryCode: "S",
        vatRate: 19,
      },
    ],
  } as Invoice;
}

/** Every field that is written into the markup, as a dotted path into the invoice. */
const INJECTION_POINTS: string[] = [
  "typeCode",
  "issueDate",
  "dueDate",
  "currencyCode", // lands in currencyID="..." attribute values too
  "seller.address.countryCode",
  "seller.identifier.id",
  "seller.identifier.schemeId",
  "buyer.identifier.id",
  "buyer.identifier.schemeId",
  "delivery.deliverTo.countryCode",
  "delivery.actualDeliveryDate",
  "precedingInvoiceReference.issueDate",
  "vatBreakdowns.0.categoryCode",
  "lines.0.vatCategoryCode",
  "allowancesCharges.0.vatCategoryCode",
];

/** Sets `value` at a dotted path ("lines.0.vatCategoryCode"), treating the invoice as untyped. */
function setPath(invoice: Invoice, path: string, value: string): void {
  const keys = path.split(".");
  const last = keys.pop() as string;
  let target = invoice as unknown as Record<string, unknown>;
  for (const key of keys) target = target[key] as Record<string, unknown>;
  target[last] = value;
}

describe.each([
  ["toXRechnung", (inv: Invoice): string => toXRechnung(inv)],
  ["toCii", (inv: Invoice): string => toCii(inv)],
])("%s XML escaping", (_name, serialize) => {
  it.each(INJECTION_POINTS)("escapes XML metacharacters in %s", (path) => {
    const invoice = baseInvoice();
    setPath(invoice, path, PAYLOAD);

    const xml = serialize(invoice);

    // Escaped form is present, so the value was written (not silently dropped)...
    expect(xml).toContain(ESCAPED);
    // Make sure no dangerous XML from the payload remains unescaped:
    expect(xml).not.toContain("<i/>");
    expect(xml).not.toContain('A"<');
  });

  it("leaves a normal invoice's output free of stray entities", () => {
    const xml = serialize(baseInvoice());
    expect(xml).not.toContain("&amp;amp;");
    expect(xml).not.toContain("&quot;");
  });
});

describe("toXRechnung credit note type code", () => {
  it("escapes a malicious typeCode on the credit-note-capable path too", () => {
    const invoice = clone(creditNoteFull) as Invoice;
    (invoice as { typeCode: string }).typeCode = PAYLOAD;
    const xml = toXRechnung(invoice);
    expect(xml).toContain(`<cbc:InvoiceTypeCode>${ESCAPED}</cbc:InvoiceTypeCode>`);
  });
});
