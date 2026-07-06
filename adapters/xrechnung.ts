import type { Invoice, Party, VatBreakdown, InvoiceLine } from "../core/index.js";
import { esc, amt } from "../core/utils/xml.js";

function renderParty(wrapperTag: string, party: Party): string {
  const schemeId = party.electronicAddressSchemeId ?? "EM";
  const line2 = party.address.line2
    ? `\n        <cbc:AdditionalStreetName>${esc(party.address.line2)}</cbc:AdditionalStreetName>`
    : "";
  const vatScheme = party.vatId
    ? `\n      <cac:PartyTaxScheme>\n        <cbc:CompanyID>${esc(party.vatId)}</cbc:CompanyID>\n        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>\n      </cac:PartyTaxScheme>`
    : "";
  const fcScheme = party.taxRegistrationId
    ? `\n      <cac:PartyTaxScheme>\n        <cbc:CompanyID>${esc(party.taxRegistrationId)}</cbc:CompanyID>\n        <cac:TaxScheme><cbc:ID>FC</cbc:ID></cac:TaxScheme>\n      </cac:PartyTaxScheme>`
    : "";
  const companyId = party.legalId
    ? `\n        <cbc:CompanyID>${esc(party.legalId)}</cbc:CompanyID>`
    : "";
  const contact = party.contact
    ? `\n      <cac:Contact>${party.contact.name ? `\n        <cbc:Name>${esc(party.contact.name)}</cbc:Name>` : ""}\n        <cbc:Telephone>${esc(party.contact.telephone)}</cbc:Telephone>\n        <cbc:ElectronicMail>${esc(party.contact.email)}</cbc:ElectronicMail>\n      </cac:Contact>`
    : "";

  return `  <${wrapperTag}>
    <cac:Party>
      <cbc:EndpointID schemeID="${esc(schemeId)}">${esc(party.electronicAddress)}</cbc:EndpointID>
      <cac:PartyName><cbc:Name>${esc(party.name)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(party.address.line1)}</cbc:StreetName>${line2}
        <cbc:CityName>${esc(party.address.city)}</cbc:CityName>
        <cbc:PostalZone>${esc(party.address.postalCode)}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>${party.address.countryCode}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>${vatScheme}${fcScheme}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(party.name)}</cbc:RegistrationName>${companyId}
      </cac:PartyLegalEntity>${contact}
    </cac:Party>
  </${wrapperTag}>`;
}

function renderPaymentMeans(pm: NonNullable<Invoice["paymentMeans"]>): string {
  const iban = pm.iban ? `\n      <cbc:ID>${esc(pm.iban)}</cbc:ID>` : "";
  const accountName = pm.accountName ? `\n      <cbc:Name>${esc(pm.accountName)}</cbc:Name>` : "";
  const bic = pm.bic
    ? `\n      <cac:FinancialInstitutionBranch><cbc:ID>${esc(pm.bic)}</cbc:ID></cac:FinancialInstitutionBranch>`
    : "";

  const account = (iban || accountName || bic)
    ? `\n    <cac:PayeeFinancialAccount>${iban}${accountName}${bic}\n    </cac:PayeeFinancialAccount>`
    : "";

  return `  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>${esc(pm.code)}</cbc:PaymentMeansCode>${account}
  </cac:PaymentMeans>`;
}

function renderVatSubtotal(bd: VatBreakdown, currency: string): string {
  const exemptionReason = bd.exemptionReason
    ? `\n        <cbc:TaxExemptionReason>${esc(bd.exemptionReason)}</cbc:TaxExemptionReason>`
    : "";
  const exemptionReasonCode = bd.exemptionReasonCode
    ? `\n        <cbc:TaxExemptionReasonCode>${esc(bd.exemptionReasonCode)}</cbc:TaxExemptionReasonCode>`
    : "";

  return `    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${currency}">${amt(bd.taxableAmount)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${currency}">${amt(bd.taxAmount)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${bd.categoryCode}</cbc:ID>
        <cbc:Percent>${bd.rate}</cbc:Percent>${exemptionReasonCode}${exemptionReason}
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`;
}

function renderLine(line: InvoiceLine, currency: string): string {
  const description = line.description
    ? `\n      <cbc:Description>${esc(line.description)}</cbc:Description>`
    : "";

  return `  <cac:InvoiceLine>
    <cbc:ID>${esc(line.id)}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${esc(line.unitCode)}">${line.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${currency}">${amt(line.lineAmount)}</cbc:LineExtensionAmount>
    <cac:Item>${description}
      <cbc:Name>${esc(line.name)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${line.vatCategoryCode}</cbc:ID>
        <cbc:Percent>${line.vatRate}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${currency}">${amt(line.unitPrice)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
}

export function toXRechnung(invoice: Invoice): string {
  const currency = invoice.currencyCode;

  const note = invoice.note ? `\n  <cbc:Note>${esc(invoice.note)}</cbc:Note>` : "";
  const buyerRef = invoice.buyerReference
    ? `\n  <cbc:BuyerReference>${esc(invoice.buyerReference)}</cbc:BuyerReference>`
    : "";
  const paymentMeans = invoice.paymentMeans
    ? `\n${renderPaymentMeans(invoice.paymentMeans)}`
    : "";
  const dueDate = invoice.dueDate
    ? `\n  <cbc:DueDate>${invoice.dueDate}</cbc:DueDate>`
    : "";

  // sum all the lineAmount 
  // using recude() many items -> one value
  const lineExtension = amt(invoice.lines.reduce((s, l) => s + l.lineAmount, 0));
  // Converting each VAT breakdown into XML
  // using map() many items -> many transformed items
  // vat1, vat2 -> xml1, xml2
  const vatSubtotals = invoice.vatBreakdowns.map((bd) => renderVatSubtotal(bd, currency)).join("\n");
  // for each invoice line(items), generate one <cac:InvoiceLine> xml element
  const invoiceLines = invoice.lines.map((l) => renderLine(l, currency)).join("\n");

  // ubl = the overall document.
  // cac = complex "object-like" structures.
  // cbc = simple data values inside those structures.
  return `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice
  xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ProfileID>${esc(invoice.businessProcessType)}</cbc:ProfileID>
  <cbc:ID>${esc(invoice.id)}</cbc:ID>
  <cbc:IssueDate>${invoice.issueDate}</cbc:IssueDate>${dueDate}
  <cbc:InvoiceTypeCode>${invoice.typeCode}</cbc:InvoiceTypeCode>${note}
  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>${buyerRef}
${renderParty("cac:AccountingSupplierParty", invoice.seller)}
${renderParty("cac:AccountingCustomerParty", invoice.buyer)}${paymentMeans}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${amt(invoice.taxAmount)}</cbc:TaxAmount>
${vatSubtotals}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currency}">${lineExtension}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currency}">${amt(invoice.taxExclusiveAmount)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${amt(invoice.taxInclusiveAmount)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${currency}">${amt(invoice.duePayableAmount)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${invoiceLines}
</ubl:Invoice>`;
}
