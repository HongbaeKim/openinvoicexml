import { describe, it, expect } from "vitest";

import { toXRechnung } from "./xrechnung.js";
import { toCii } from "./cii.js";
import { mapParty as mapUblParty } from "./xrechnung-mapping.js";
import { mapParty as mapCiiParty } from "./cii-mapping.js";
import type { Invoice } from "../core/index.js";
import { domesticSimple } from "../fixtures/index.js";

function withSeller(identifier?: { id: string; schemeId?: string }): Invoice {
  const invoice = JSON.parse(JSON.stringify(domesticSimple)) as Invoice;
  if (identifier) invoice.seller.identifier = identifier;
  return invoice;
}

describe.each([
  ["xrechnung-mapping", mapUblParty],
  ["cii-mapping", mapCiiParty],
])("%s mapParty identifier", (_n, mapParty) => {
  it("passes identifier through", () => {
    const party = withSeller({ id: "X1", schemeId: "0204" }).seller;
    expect(mapParty(party).identifier).toEqual({ id: "X1", schemeId: "0204" });
  });
  it("leaves it undefined when absent", () => {
    expect(mapParty(withSeller().seller).identifier).toBeUndefined();
  });
});

describe("UBL BT-29 rendering", () => {
  it("renders PartyIdentification after EndpointID and before PartyName", () => {
    const xml = toXRechnung(withSeller({ id: "X1" }));
    expect(xml).toContain("<cac:PartyIdentification>\n        <cbc:ID>X1</cbc:ID>");
    const seller = xml.slice(xml.indexOf("<cac:AccountingSupplierParty>"));
    // EndpointID < PartyIdentification < PartyName
    expect(seller.indexOf("EndpointID")).toBeLessThan(seller.indexOf("PartyIdentification"));
    expect(seller.indexOf("PartyIdentification")).toBeLessThan(seller.indexOf("<cac:PartyName>"));
  });
  it("adds schemeID only when a scheme is set", () => {
    expect(toXRechnung(withSeller({ id: "X1", schemeId: "0204" }))).toContain(
      '<cbc:ID schemeID="0204">X1</cbc:ID>',
    );
    expect(toXRechnung(withSeller({ id: "X1" }))).not.toContain("<cbc:ID schemeID=");
    expect(toXRechnung(withSeller({ id: "X1" }))).toContain("<cbc:ID>X1</cbc:ID>");
  });
  it("omits PartyIdentification without an identifier", () => {
    expect(toXRechnung(withSeller())).not.toContain("PartyIdentification");
  });
});

describe("CII BT-29 rendering", () => {
  it("renders ram:ID as first child of the seller party, before ram:Name", () => {
    const xml = toCii(withSeller({ id: "X1" }));
    const seller = xml.slice(xml.indexOf("<ram:SellerTradeParty>"));
    expect(seller).toMatch(/<ram:SellerTradeParty>\s*<ram:ID>X1<\/ram:ID>\s*<ram:Name>/);
  });
  it("renders ram:GlobalID with schemeID when a scheme is set", () => {
    const xml = toCii(withSeller({ id: "X1", schemeId: "0204" }));
    const seller = xml.slice(xml.indexOf("<ram:SellerTradeParty>"));
    expect(seller).toMatch(
      /<ram:SellerTradeParty>\s*<ram:GlobalID schemeID="0204">X1<\/ram:GlobalID>\s*<ram:Name>/,
    );
    expect(seller).not.toMatch(/<ram:SellerTradeParty>\s*<ram:ID>/);
  });
  it("emits nothing extra without an identifier", () => {
    const xml = toCii(withSeller());
    expect(xml).not.toContain("GlobalID");
    expect(xml).not.toMatch(/<ram:SellerTradeParty>\s*<ram:ID>/);
  });
});
