import type { Invoice } from "../core/index.js";
import { escapeXml } from "./xml-escape.js";
import { formatAmount, formatUnitPrice } from "../core/utils/monetary.js";
import {
  mapInvoice,
  type PartyFields,
  type PaymentMeansFields,
  type VatSubtotalFields,
  type LineFields,
  type DeliveryFields,
  type PrecedingInvoiceReferenceFields,
  type AllowanceChargeFields,
} from "./xrechnung-mapping.js";

/**
 * XML serialization — turns already-resolved field structures (see xrechnung-mapping.ts) into
 * UBL 2.1 markup. Escaping and tag/element structure live here; no field defaulting or
 * derivation belongs in this file.
 */

function renderBillingReference(ref: PrecedingInvoiceReferenceFields): string {
  return `  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${escapeXml(ref.id)}</cbc:ID>
      <cbc:IssueDate>${escapeXml(ref.issueDate)}</cbc:IssueDate>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>`;
}

function renderParty(wrapperTag: string, party: PartyFields): string {
  const line2 = party.addressLine2
    ? `\n        <cbc:AdditionalStreetName>${escapeXml(party.addressLine2)}</cbc:AdditionalStreetName>`
    : "";
  const vatScheme = party.vatId
    ? `\n      <cac:PartyTaxScheme>\n        <cbc:CompanyID>${escapeXml(party.vatId)}</cbc:CompanyID>\n        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>\n      </cac:PartyTaxScheme>`
    : "";
  const fcScheme = party.taxRegistrationId
    ? `\n      <cac:PartyTaxScheme>\n        <cbc:CompanyID>${escapeXml(party.taxRegistrationId)}</cbc:CompanyID>\n        <cac:TaxScheme><cbc:ID>FC</cbc:ID></cac:TaxScheme>\n      </cac:PartyTaxScheme>`
    : "";
  const companyId = party.legalId
    ? `\n        <cbc:CompanyID>${escapeXml(party.legalId)}</cbc:CompanyID>`
    : "";
  const identifier = party.identifier
    ? `\n      <cac:PartyIdentification>\n        <cbc:ID${party.identifier.schemeId ? ` schemeID="${escapeXml(party.identifier.schemeId)}"` : ""}>${escapeXml(party.identifier.id)}</cbc:ID>\n      </cac:PartyIdentification>`
    : "";
  const contact = party.contact
    ? `\n      <cac:Contact>${party.contact.name ? `\n        <cbc:Name>${escapeXml(party.contact.name)}</cbc:Name>` : ""}\n        <cbc:Telephone>${escapeXml(party.contact.telephone)}</cbc:Telephone>\n        <cbc:ElectronicMail>${escapeXml(party.contact.email)}</cbc:ElectronicMail>\n      </cac:Contact>`
    : "";

  return `  <${wrapperTag}>
    <cac:Party>
      <cbc:EndpointID schemeID="${escapeXml(party.schemeId)}">${escapeXml(party.electronicAddress)}</cbc:EndpointID>${identifier}
      <cac:PartyName><cbc:Name>${escapeXml(party.name)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(party.addressLine1)}</cbc:StreetName>${line2}
        <cbc:CityName>${escapeXml(party.city)}</cbc:CityName>
        <cbc:PostalZone>${escapeXml(party.postalCode)}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>${escapeXml(party.countryCode)}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>${vatScheme}${fcScheme}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(party.name)}</cbc:RegistrationName>${companyId}
      </cac:PartyLegalEntity>${contact}
    </cac:Party>
  </${wrapperTag}>`;
}

function renderDelivery(delivery: DeliveryFields): string {
  const actualDeliveryDate = delivery.actualDeliveryDate
    ? `\n    <cbc:ActualDeliveryDate>${escapeXml(delivery.actualDeliveryDate)}</cbc:ActualDeliveryDate>`
    : "";
  const deliverTo = delivery.deliverTo;
  const city = deliverTo?.city ? `\n        <cbc:CityName>${escapeXml(deliverTo.city)}</cbc:CityName>` : "";
  const postalCode = deliverTo?.postalCode
    ? `\n        <cbc:PostalZone>${escapeXml(deliverTo.postalCode)}</cbc:PostalZone>`
    : "";
  const country = deliverTo?.countryCode
    ? `\n        <cac:Country><cbc:IdentificationCode>${escapeXml(deliverTo.countryCode)}</cbc:IdentificationCode></cac:Country>`
    : "";
  const deliveryLocation =
    city || postalCode || country
      ? `\n    <cac:DeliveryLocation>\n      <cac:Address>${city}${postalCode}${country}\n      </cac:Address>\n    </cac:DeliveryLocation>`
      : "";

  return `  <cac:Delivery>${actualDeliveryDate}${deliveryLocation}
  </cac:Delivery>`;
}

function renderPaymentMeans(pm: PaymentMeansFields): string {
  const iban = pm.iban ? `\n      <cbc:ID>${escapeXml(pm.iban)}</cbc:ID>` : "";
  const accountName = pm.accountName ? `\n      <cbc:Name>${escapeXml(pm.accountName)}</cbc:Name>` : "";
  const bic = pm.bic
    ? `\n      <cac:FinancialInstitutionBranch><cbc:ID>${escapeXml(pm.bic)}</cbc:ID></cac:FinancialInstitutionBranch>`
    : "";

  const account =
    iban || accountName || bic
      ? `\n    <cac:PayeeFinancialAccount>${iban}${accountName}${bic}\n    </cac:PayeeFinancialAccount>`
      : "";

  return `  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>${escapeXml(pm.code)}</cbc:PaymentMeansCode>${account}
  </cac:PaymentMeans>`;
}

function renderVatSubtotal(bd: VatSubtotalFields, currency: string): string {
  const exemptionReason = bd.exemptionReason
    ? `\n        <cbc:TaxExemptionReason>${escapeXml(bd.exemptionReason)}</cbc:TaxExemptionReason>`
    : "";
  const exemptionReasonCode = bd.exemptionReasonCode
    ? `\n        <cbc:TaxExemptionReasonCode>${escapeXml(bd.exemptionReasonCode)}</cbc:TaxExemptionReasonCode>`
    : "";

  return `    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${currency}">${formatAmount(bd.taxableAmount)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${currency}">${formatAmount(bd.taxAmount)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${escapeXml(bd.categoryCode)}</cbc:ID>
        <cbc:Percent>${bd.rate}</cbc:Percent>${exemptionReasonCode}${exemptionReason}
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`;
}

// BG-20/BG-21 = document-level discounts/charges.
// BG-27/BG-28 = line-level discounts/charges.
//
// UBL requires this order:
// ChargeIndicator → reason → Amount → TaxCategory.
//
// TaxCategory is only added for document-level discounts/charges.
// Line-level discounts/charges use the VAT category of their invoice line.
function renderAllowanceCharge(ac: AllowanceChargeFields, currency: string): string {
  const reasonCode = ac.reasonCode
    ? `\n      <cbc:AllowanceChargeReasonCode>${escapeXml(ac.reasonCode)}</cbc:AllowanceChargeReasonCode>`
    : "";
  const reason = ac.reason
    ? `\n      <cbc:AllowanceChargeReason>${escapeXml(ac.reason)}</cbc:AllowanceChargeReason>`
    : "";
  // BR-O-06/07: category 'O' must have no cbc:Percent at all (not even 0) — mirrors
  // renderLine's own category-'O' cbc:Percent suppression below.
  const percent =
    ac.vatCategoryCode === "O" || ac.vatRate === undefined
      ? ""
      : `\n        <cbc:Percent>${ac.vatRate}</cbc:Percent>`;
  const taxCategory =
    ac.vatCategoryCode !== undefined
      ? `\n      <cac:TaxCategory>\n        <cbc:ID>${escapeXml(ac.vatCategoryCode)}</cbc:ID>${percent}\n        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>\n      </cac:TaxCategory>`
      : "";

  return `    <cac:AllowanceCharge>
      <cbc:ChargeIndicator>${ac.isCharge}</cbc:ChargeIndicator>${reasonCode}${reason}
      <cbc:Amount currencyID="${currency}">${formatAmount(ac.amount)}</cbc:Amount>${taxCategory}
    </cac:AllowanceCharge>`;
}

function renderLine(line: LineFields, currency: string, isCreditNote: boolean): string {
  const description = line.description
    ? `\n      <cbc:Description>${escapeXml(line.description)}</cbc:Description>`
    : "";
  // BR-O-05: an invoice line whose VAT category is 'O' (outside VAT scope) must not
  // carry an item VAT rate at all — not even 0.
  const percent =
    line.vatCategoryCode === "O" ? "" : `\n        <cbc:Percent>${line.vatRate}</cbc:Percent>`;
  // UBL (Universal Business Language) models credit note lines 
  // as cac:CreditNoteLine/cbc:CreditedQuantity, distinct from
  // cac:InvoiceLine/cbc:InvoicedQuantity used by every other document type.
  const lineTag = isCreditNote ? "CreditNoteLine" : "InvoiceLine";
  const quantityTag = isCreditNote ? "CreditedQuantity" : "InvoicedQuantity";
  // BG-27/BG-28: cac:AllowanceCharge sits between LineExtensionAmount and Item in
  // InvoiceLineType's fixed element sequence (UBL-CommonAggregateComponents-2.1.xsd).
  const lineAllowancesCharges = line.allowancesCharges.length
    ? `\n${line.allowancesCharges.map((ac) => renderAllowanceCharge(ac, currency)).join("\n")}`
    : "";

  return `  <cac:${lineTag}>
    <cbc:ID>${escapeXml(line.id)}</cbc:ID>
    <cbc:${quantityTag} unitCode="${escapeXml(line.unitCode)}">${line.quantity}</cbc:${quantityTag}>
    <cbc:LineExtensionAmount currencyID="${currency}">${formatAmount(line.lineAmount)}</cbc:LineExtensionAmount>${lineAllowancesCharges}
    <cac:Item>${description}
      <cbc:Name>${escapeXml(line.name)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${escapeXml(line.vatCategoryCode)}</cbc:ID>${percent}
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${currency}">${formatUnitPrice(line.unitPrice)}</cbc:PriceAmount>
    </cac:Price>
  </cac:${lineTag}>`;
}

export function toXRechnung(invoice: Invoice): string {
  const fields = mapInvoice(invoice);
  // Escaped once here because it is interpolated into currencyID="..." attribute values in many
  // renderers; an unescaped `"` would break out of the attribute.
  const currency = escapeXml(fields.currencyCode);

  // A credit note (381) is its own UBL document type — CreditNote-2, not Invoice-2 — with a
  // cbc:CreditNoteTypeCode instead of cbc:InvoiceTypeCode and cac:CreditNoteLine instead of
  // cac:InvoiceLine. Everything else (parties, totals, VAT breakdown, BillingReference) is
  // shared structure. See tools/kosit/config/scenarios.xml's "EN16931 XRechnung (UBL
  // CreditNote)" scenario, which matches on this exact root/namespace.
  const isCreditNote = fields.typeCode === "381";
  const rootTag = isCreditNote ? "CreditNote" : "Invoice";
  const namespace = isCreditNote
    ? "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
    : "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
  const typeCodeTag = isCreditNote ? "CreditNoteTypeCode" : "InvoiceTypeCode";

  const note = fields.note ? `\n  <cbc:Note>${escapeXml(fields.note)}</cbc:Note>` : "";
  const buyerRef = fields.buyerReference
    ? `\n  <cbc:BuyerReference>${escapeXml(fields.buyerReference)}</cbc:BuyerReference>`
    : "";
  const billingReference = fields.precedingInvoiceReference
    ? `\n${renderBillingReference(fields.precedingInvoiceReference)}`
    : "";
  // BT-13: cac:OrderReference sits before cac:BillingReference in UBL-Invoice-2.1.xsd's fixed
  // element sequence; only cbc:ID is mapped, matching cac:ContractDocumentReference below.
  const orderReference = fields.purchaseOrderReference
    ? `\n  <cac:OrderReference>\n    <cbc:ID>${escapeXml(fields.purchaseOrderReference)}</cbc:ID>\n  </cac:OrderReference>`
    : "";
  // BT-12: cac:ContractDocumentReference sits between BillingReference and the parties in
  // UBL-Invoice-2.1.xsd's fixed element sequence; only cbc:ID is mapped (BR rules discourage
  // every other DocumentReferenceType child here, e.g. UBL-CR-096 for IssueDate).
  const contractReference = fields.contractReference
    ? `\n  <cac:ContractDocumentReference>\n    <cbc:ID>${escapeXml(fields.contractReference)}</cbc:ID>\n  </cac:ContractDocumentReference>`
    : "";
  const delivery = fields.delivery ? `\n${renderDelivery(fields.delivery)}` : "";
  const paymentMeans = fields.paymentMeans ? `\n${renderPaymentMeans(fields.paymentMeans)}` : "";
  // BG-20/BG-21: document-level discounts/charges must come before cac:TaxTotal.
  // Since this invoice does not use PaymentTerms or PrepaidPayment,
  // they are added directly after PaymentMeans.
  const documentAllowancesCharges = fields.allowancesCharges.length
    ? `\n${fields.allowancesCharges.map((ac) => renderAllowanceCharge(ac, currency)).join("\n")}`
    : "";
  // CreditNoteType has no cbc:DueDate element at all (UBL-CreditNote-2.1.xsd) — a credit
  // reduces what's owed, it doesn't create a new payment deadline.
  const dueDate =
    !isCreditNote && fields.dueDate ? `\n  <cbc:DueDate>${escapeXml(fields.dueDate)}</cbc:DueDate>` : "";
  const prepaidAmount = fields.prepaidAmount
    ? `\n    <cbc:PrepaidAmount currencyID="${currency}">${formatAmount(fields.prepaidAmount)}</cbc:PrepaidAmount>`
    : "";
  // BT-114: UBL MonetaryTotalType requires this order:
  // PrepaidAmount → PayableRoundingAmount → PayableAmount.
  const roundingAmount = fields.roundingAmount
    ? `\n    <cbc:PayableRoundingAmount currencyID="${currency}">${formatAmount(fields.roundingAmount)}</cbc:PayableRoundingAmount>`
    : "";
  // Line-level discounts/charges change BT-131.
  //
  // BT-106 = sum of all line net amounts.
  // BT-107 = sum of document-level discounts. sum of BG-20
  // BT-108 = sum of document-level charges. sum of BG-21
  // BT-109 = total amount before VAT.
  //
  // Formula:
  // BT-109 = BT-106 - BT-107 + BT-108
  //
  // In UBL, AllowanceTotalAmount (BT-107) and ChargeTotalAmount (BT-108)
  // must appear between TaxInclusiveAmount and PrepaidAmount in MonetaryTotalType's fixed order.
  // They are required when document-level allowances/charges exist.
  const allowanceTotalAmount = fields.allowanceTotalAmount
    ? `\n    <cbc:AllowanceTotalAmount currencyID="${currency}">${formatAmount(fields.allowanceTotalAmount)}</cbc:AllowanceTotalAmount>`
    : "";
  const chargeTotalAmount = fields.chargeTotalAmount
    ? `\n    <cbc:ChargeTotalAmount currencyID="${currency}">${formatAmount(fields.chargeTotalAmount)}</cbc:ChargeTotalAmount>`
    : "";

  const lineExtension = formatAmount(fields.lineExtensionAmount);
  // Converting each VAT breakdown into XML
  // using map() many items -> many transformed items
  // vat1, vat2 -> xml1, xml2
  const vatSubtotals = fields.vatSubtotals.map((bd) => renderVatSubtotal(bd, currency)).join("\n");

  // for each invoice line(items), generate one <cac:InvoiceLine>/<cac:CreditNoteLine> xml element
  const invoiceLines = fields.lines.map((l) => renderLine(l, currency, isCreditNote)).join("\n");

  // ubl = the overall document.
  // cac = complex "object-like" structures.
  // cbc = simple data values inside those structures.
  return `<?xml version="1.0" encoding="UTF-8"?>
<ubl:${rootTag}
  xmlns:ubl="${namespace}"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ProfileID>${escapeXml(fields.businessProcessType)}</cbc:ProfileID>
  <cbc:ID>${escapeXml(fields.id)}</cbc:ID>
  <cbc:IssueDate>${escapeXml(fields.issueDate)}</cbc:IssueDate>${dueDate}
  <cbc:${typeCodeTag}>${escapeXml(fields.typeCode)}</cbc:${typeCodeTag}>${note}
  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>${buyerRef}${orderReference}${billingReference}${contractReference}
${renderParty("cac:AccountingSupplierParty", fields.seller)}
${renderParty("cac:AccountingCustomerParty", fields.buyer)}${delivery}${paymentMeans}${documentAllowancesCharges}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${formatAmount(fields.taxAmount)}</cbc:TaxAmount>
${vatSubtotals}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currency}">${lineExtension}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currency}">${formatAmount(fields.taxExclusiveAmount)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${formatAmount(fields.taxInclusiveAmount)}</cbc:TaxInclusiveAmount>${allowanceTotalAmount}${chargeTotalAmount}${prepaidAmount}${roundingAmount}
    <cbc:PayableAmount currencyID="${currency}">${formatAmount(fields.duePayableAmount)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${invoiceLines}
</ubl:${rootTag}>`;
}
