import type { Invoice } from "../core/index.js";
import { escapeXml } from "./xml-escape.js";
import { formatAmount, formatUnitPrice } from "../core/utils/monetary.js";
import type { EInvoiceProfile } from "../core/types/profile.js";
import {
  mapInvoice,
  type PartyFields,
  type PaymentMeansFields,
  type VatSubtotalFields,
  type LineFields,
  type DeliveryFields,
  type PrecedingInvoiceReferenceFields,
  type AllowanceChargeFields,
} from "./cii-mapping.js";

/**
 * XML serialization — converts the prepared data from cii-mapping.ts
 * into CII XML used by Factur-X and ZUGFeRD.
 * XML details such as escaping, tag names, and element order are handled here.
 * Default values and calculated fields should be handled in cii-mapping.ts instead.
 *
 * Element order below is confirmed against the real vendored XSD family in
 * tools/kosit/config/resources/cii/16b/xsd/ (CrossIndustryInvoice_100pD16B.xsd and
 * CrossIndustryInvoice_ReusableAggregateBusinessInformationEntity_100pD16B.xsd), not assumed by
 * analogy to xrechnung.ts's UBL ordering — CII's XSDs are strict about child element sequence.
 */

/** CII qdt:DocumentCodeType-style dates use format "102" — YYYYMMDD, no separators. */
function dt102(isoDate: string): string {
  // Escaped as well as stripped of dashes: a date like `2026"<x/>` must not reach the markup raw.
  return escapeXml(isoDate.replace(/-/g, ""));
}

function renderDateTime(isoDate: string, tag: string): string {
  return `<ram:${tag}>\n        <udt:DateTimeString format="102">${dt102(isoDate)}</udt:DateTimeString>\n      </ram:${tag}>`;
}

function renderReferencedDocument(
  wrapperTag: string,
  id: string,
  issueDate?: string,
  indent = "  ",
): string {
  const formattedIssueDate = issueDate
    ? `\n${indent}    <ram:FormattedIssueDateTime>\n${indent}      <qdt:DateTimeString format="102">${dt102(issueDate)}</qdt:DateTimeString>\n${indent}    </ram:FormattedIssueDateTime>`
    : "";
  return `${indent}<ram:${wrapperTag}>\n${indent}  <ram:IssuerAssignedID>${escapeXml(id)}</ram:IssuerAssignedID>${formattedIssueDate}\n${indent}</ram:${wrapperTag}>`;
}

function renderInvoiceReferencedDocument(ref: PrecedingInvoiceReferenceFields): string {
  return renderReferencedDocument("InvoiceReferencedDocument", ref.id, ref.issueDate, "    ");
}

function renderParty(wrapperTag: string, party: PartyFields): string {
  // CII-SR-224/CII-SR-252 (confirmed by a real KoSIT run): 
  // SpecifiedLegalOrganization/Name should not be present
  // The party already has its own Name, so adding it again would be duplicate data. 
  // Only create SpecifiedLegalOrganization when legalId exists, and only include the ID.
  const legalOrg = party.legalId
    ? `\n      <ram:SpecifiedLegalOrganization>\n        <ram:ID>${escapeXml(party.legalId)}</ram:ID>\n      </ram:SpecifiedLegalOrganization>`
    : "";

  // BT-29 / BT-46: ram:ID without a scheme, ram:GlobalID with one. Both precede ram:Name.
  const identifier = party.identifier
    ? party.identifier.schemeId
      ? `\n      <ram:GlobalID schemeID="${escapeXml(party.identifier.schemeId)}">${escapeXml(party.identifier.id)}</ram:GlobalID>`
      : `\n      <ram:ID>${escapeXml(party.identifier.id)}</ram:ID>`
    : "";

  const contact = party.contact
    ? `\n      <ram:DefinedTradeContact>${
        party.contact.name ? `\n        <ram:PersonName>${escapeXml(party.contact.name)}</ram:PersonName>` : ""
      }
        <ram:TelephoneUniversalCommunication>
          <ram:CompleteNumber>${escapeXml(party.contact.telephone)}</ram:CompleteNumber>
        </ram:TelephoneUniversalCommunication>
        <ram:EmailURIUniversalCommunication>
          <ram:URIID>${escapeXml(party.contact.email)}</ram:URIID>
        </ram:EmailURIUniversalCommunication>
      </ram:DefinedTradeContact>`
    : "";

  const line2 = party.addressLine2
    ? `\n        <ram:LineTwo>${escapeXml(party.addressLine2)}</ram:LineTwo>`
    : "";
  const address = `\n      <ram:PostalTradeAddress>
        <ram:PostcodeCode>${escapeXml(party.postalCode)}</ram:PostcodeCode>
        <ram:LineOne>${escapeXml(party.addressLine1)}</ram:LineOne>${line2}
        <ram:CityName>${escapeXml(party.city)}</ram:CityName>
        <ram:CountryID>${escapeXml(party.countryCode)}</ram:CountryID>
      </ram:PostalTradeAddress>`;

  const electronicAddress = `\n      <ram:URIUniversalCommunication>
        <ram:URIID schemeID="${escapeXml(party.schemeId)}">${escapeXml(party.electronicAddress)}</ram:URIID>
      </ram:URIUniversalCommunication>`;

  const vatRegistration = party.vatId
    ? `\n      <ram:SpecifiedTaxRegistration>\n        <ram:ID schemeID="VA">${escapeXml(party.vatId)}</ram:ID>\n      </ram:SpecifiedTaxRegistration>`
    : "";
  const fcRegistration = party.taxRegistrationId
    ? `\n      <ram:SpecifiedTaxRegistration>\n        <ram:ID schemeID="FC">${escapeXml(party.taxRegistrationId)}</ram:ID>\n      </ram:SpecifiedTaxRegistration>`
    : "";

  return `  <ram:${wrapperTag}>${identifier}
      <ram:Name>${escapeXml(party.name)}</ram:Name>${legalOrg}${contact}${address}${electronicAddress}${vatRegistration}${fcRegistration}
  </ram:${wrapperTag}>`;
}

function renderShipTo(delivery: DeliveryFields): string {
  const deliverTo = delivery.deliverTo;
  if (!deliverTo) return "";
  const city = deliverTo.city ? `\n        <ram:CityName>${escapeXml(deliverTo.city)}</ram:CityName>` : "";
  const postalCode = deliverTo.postalCode
    ? `\n        <ram:PostcodeCode>${escapeXml(deliverTo.postalCode)}</ram:PostcodeCode>`
    : "";
  const country = deliverTo.countryCode
    ? `\n        <ram:CountryID>${escapeXml(deliverTo.countryCode)}</ram:CountryID>`
    : "";
  if (!city && !postalCode && !country) return "";
  return `\n    <ram:ShipToTradeParty>\n      <ram:PostalTradeAddress>${postalCode}${city}${country}\n      </ram:PostalTradeAddress>\n    </ram:ShipToTradeParty>`;
}

function renderActualDelivery(delivery: DeliveryFields): string {
  if (!delivery.actualDeliveryDate) return "";
  return `\n    <ram:ActualDeliverySupplyChainEvent>\n      <ram:OccurrenceDateTime>\n        <udt:DateTimeString format="102">${dt102(delivery.actualDeliveryDate)}</udt:DateTimeString>\n      </ram:OccurrenceDateTime>\n    </ram:ActualDeliverySupplyChainEvent>`;
}

function renderPaymentMeans(pm: PaymentMeansFields): string {
  const account =
    pm.iban || pm.accountName
      ? `\n      <ram:PayeePartyCreditorFinancialAccount>${
          pm.iban ? `\n        <ram:IBANID>${escapeXml(pm.iban)}</ram:IBANID>` : ""
        }${
          pm.accountName ? `\n        <ram:AccountName>${escapeXml(pm.accountName)}</ram:AccountName>` : ""
        }\n      </ram:PayeePartyCreditorFinancialAccount>`
      : "";
  const institution = pm.bic
    ? `\n      <ram:PayeeSpecifiedCreditorFinancialInstitution>\n        <ram:BICID>${escapeXml(pm.bic)}</ram:BICID>\n      </ram:PayeeSpecifiedCreditorFinancialInstitution>`
    : "";

  return `    <ram:SpecifiedTradeSettlementPaymentMeans>
      <ram:TypeCode>${escapeXml(pm.code)}</ram:TypeCode>${account}${institution}
    </ram:SpecifiedTradeSettlementPaymentMeans>`;
}

/**
 * BT-152 (invoice line) and BT-96/BT-103 (allowance/charge):
 * for VAT category "O", do not include the VAT percent
 * (required by BR-O-05/06/07).
 *
 * BT-119 (document-level VAT breakdown) is different:
 * it must still include a percent, so category "O" uses 0%.
 *
 * This matches the same behavior in the UBL renderer.
 */
function renderRateApplicablePercent(categoryCode: string, rate: number | undefined): string {
  return categoryCode === "O" || rate === undefined
    ? ""
    : `\n        <ram:RateApplicablePercent>${rate}</ram:RateApplicablePercent>`;
}

function renderBreakdownRateApplicablePercent(rate: number): string {
  return `\n        <ram:RateApplicablePercent>${rate}</ram:RateApplicablePercent>`;
}

function renderVatSubtotal(bd: VatSubtotalFields): string {
  const exemptionReason = bd.exemptionReason
    ? `\n        <ram:ExemptionReason>${escapeXml(bd.exemptionReason)}</ram:ExemptionReason>`
    : "";
  const exemptionReasonCode = bd.exemptionReasonCode
    ? `\n        <ram:ExemptionReasonCode>${escapeXml(bd.exemptionReasonCode)}</ram:ExemptionReasonCode>`
    : "";
  const percent = renderBreakdownRateApplicablePercent(bd.rate);

  // ram:TradeTaxType's fixed sequence: CalculatedAmount, TypeCode, ExemptionReason, ...,
  // BasisAmount, CategoryCode, ..., ExemptionReasonCode, ..., RateApplicablePercent.
  //
  // CII-DT-031: currencyID must NOT be present on CalculatedAmount/BasisAmount (or on any
  // amount below except the header ram:TaxTotalAmount, BT-110) — currency is already
  // established once via ram:InvoiceCurrencyCode; confirmed against a real KoSIT rejection
  // during Task 1's validate-as-you-go pass, not assumed by analogy to UBL's per-amount
  // currencyID convention.
  return `    <ram:ApplicableTradeTax>
      <ram:CalculatedAmount>${formatAmount(bd.taxAmount)}</ram:CalculatedAmount>
      <ram:TypeCode>VAT</ram:TypeCode>${exemptionReason}
      <ram:BasisAmount>${formatAmount(bd.taxableAmount)}</ram:BasisAmount>
      <ram:CategoryCode>${escapeXml(bd.categoryCode)}</ram:CategoryCode>${exemptionReasonCode}${percent}
    </ram:ApplicableTradeTax>`;
}

// BG-20/BG-21 (document level) / BG-27/BG-28 (line level) — ram:TradeAllowanceChargeType's fixed
// sequence: ChargeIndicator, ..., ActualAmount, ..., ReasonCode, Reason, ..., CategoryTradeTax.
// CategoryTradeTax is only present for document-level allowances/charges, same as UBL's
// cac:TaxCategory — line-level entries inherit the line's own VAT category.
function renderAllowanceCharge(ac: AllowanceChargeFields, indent: string): string {
  const reasonCode = ac.reasonCode
    ? `\n${indent}  <ram:ReasonCode>${escapeXml(ac.reasonCode)}</ram:ReasonCode>`
    : "";
  const reason = ac.reason ? `\n${indent}  <ram:Reason>${escapeXml(ac.reason)}</ram:Reason>` : "";
  const percent = renderRateApplicablePercent(ac.vatCategoryCode ?? "", ac.vatRate);
  const categoryTradeTax =
    ac.vatCategoryCode !== undefined
      ? `\n${indent}  <ram:CategoryTradeTax>\n${indent}    <ram:TypeCode>VAT</ram:TypeCode>\n${indent}    <ram:CategoryCode>${escapeXml(ac.vatCategoryCode)}</ram:CategoryCode>${percent}\n${indent}  </ram:CategoryTradeTax>`
      : "";

  // CII-DT-031: no currencyID on ActualAmount — see renderVatSubtotal's note above.
  return `${indent}<ram:SpecifiedTradeAllowanceCharge>
${indent}  <ram:ChargeIndicator>
${indent}    <udt:Indicator>${ac.isCharge}</udt:Indicator>
${indent}  </ram:ChargeIndicator>
${indent}  <ram:ActualAmount>${formatAmount(ac.amount)}</ram:ActualAmount>${reasonCode}${reason}${categoryTradeTax}
${indent}</ram:SpecifiedTradeAllowanceCharge>`;
}

// ram:SupplyChainTradeLineItemType's fixed sequence: AssociatedDocumentLineDocument,
// SpecifiedTradeProduct, SpecifiedLineTradeAgreement, SpecifiedLineTradeDelivery,
// SpecifiedLineTradeSettlement.
function renderLine(line: LineFields): string {
  const description = line.description
    ? `\n      <ram:Description>${escapeXml(line.description)}</ram:Description>`
    : "";
  const lineAllowancesCharges = line.allowancesCharges.length
    ? `\n${line.allowancesCharges.map((ac) => renderAllowanceCharge(ac, "      ")).join("\n")}`
    : "";
  const percent = renderRateApplicablePercent(line.vatCategoryCode, line.vatRate);

  // CII-DT-031: no currencyID on ChargeAmount/LineTotalAmount — see renderVatSubtotal's note.
  return `  <ram:IncludedSupplyChainTradeLineItem>
    <ram:AssociatedDocumentLineDocument>
      <ram:LineID>${escapeXml(line.id)}</ram:LineID>
    </ram:AssociatedDocumentLineDocument>
    <ram:SpecifiedTradeProduct>
      <ram:Name>${escapeXml(line.name)}</ram:Name>${description}
    </ram:SpecifiedTradeProduct>
    <ram:SpecifiedLineTradeAgreement>
      <ram:NetPriceProductTradePrice>
        <ram:ChargeAmount>${formatUnitPrice(line.unitPrice)}</ram:ChargeAmount>
      </ram:NetPriceProductTradePrice>
    </ram:SpecifiedLineTradeAgreement>
    <ram:SpecifiedLineTradeDelivery>
      <ram:BilledQuantity unitCode="${escapeXml(line.unitCode)}">${line.quantity}</ram:BilledQuantity>
    </ram:SpecifiedLineTradeDelivery>
    <ram:SpecifiedLineTradeSettlement>
      <ram:ApplicableTradeTax>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:CategoryCode>${escapeXml(line.vatCategoryCode)}</ram:CategoryCode>${percent}
      </ram:ApplicableTradeTax>${lineAllowancesCharges}
      <ram:SpecifiedTradeSettlementLineMonetarySummation>
        <ram:LineTotalAmount>${formatAmount(line.lineAmount)}</ram:LineTotalAmount>
      </ram:SpecifiedTradeSettlementLineMonetarySummation>
    </ram:SpecifiedLineTradeSettlement>
  </ram:IncludedSupplyChainTradeLineItem>`;
}

/**
 * The two CII profile IDs used by KoSIT:
 * one for EN16931 and one for XRechnung.
 * These exact IDs make toCii() match KoSIT's real CII validation scenarios.
 */
const GUIDELINE_ID: Record<EInvoiceProfile, string> = {
  EN16931: "urn:cen.eu:en16931:2017",
  XRECHNUNG: "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0",
};

/**
 * Checks that the profile is either "EN16931" or "XRECHNUNG".
 *
 * TypeScript normally prevents invalid profiles, but JavaScript can still pass them.
 * Without this check, an invalid profile could generate broken XML
 * (<ram:ID>undefined</ram:ID>) without showing an error.
 *
 * Uses hasOwnProperty to reject invalid values like "toString" and "__proto__".
 *
 * If the check passes, TypeScript can trust that the profile is an EInvoiceProfile.
 * If this function finishes without an error, I know profile is either EN16931 or XRECHNUNG.
 */
export function assertSupportedProfile(profile: unknown): asserts profile is EInvoiceProfile {
  // if (notAString || notSupportedProfile)
  if (typeof profile !== "string" || !Object.prototype.hasOwnProperty.call(GUIDELINE_ID, profile)) {
    throw new Error(
      `Unsupported profile ${JSON.stringify(profile)}: supported profiles are "EN16931" and "XRECHNUNG".`,
    );
  }
}

export function toCii(invoice: Invoice, options: { profile?: EInvoiceProfile } = {}): string {
  const profile = options.profile ?? "EN16931";
  assertSupportedProfile(profile);
  const fields = mapInvoice(invoice);
  // Escaped once: interpolated into currencyID="..." attribute values below.
  const currency = escapeXml(fields.currencyCode);

  const businessProcess = fields.businessProcessType
    ? `\n    <ram:BusinessProcessSpecifiedDocumentContextParameter>\n      <ram:ID>${escapeXml(fields.businessProcessType)}</ram:ID>\n    </ram:BusinessProcessSpecifiedDocumentContextParameter>`
    : "";

  const note = fields.note
    ? `\n    <ram:IncludedNote>\n      <ram:Content>${escapeXml(fields.note)}</ram:Content>\n    </ram:IncludedNote>`
    : "";

  // The newline is mainly for readability
  const lines = fields.lines.map((l) => renderLine(l)).join("\n");

  // ram:HeaderTradeAgreementType's fixed sequence: ..., BuyerReference, SellerTradeParty,
  // BuyerTradeParty, ..., BuyerOrderReferencedDocument (BT-13), ..., ContractReferencedDocument
  // (BT-12), ...
  const buyerReference = fields.buyerReference
    ? `\n    <ram:BuyerReference>${escapeXml(fields.buyerReference)}</ram:BuyerReference>`
    : "";
  const orderReference = fields.purchaseOrderReference
    ? `\n${renderReferencedDocument("BuyerOrderReferencedDocument", fields.purchaseOrderReference, undefined, "    ")}`
    : "";
  const contractReference = fields.contractReference
    ? `\n${renderReferencedDocument("ContractReferencedDocument", fields.contractReference, undefined, "    ")}`
    : "";

  // ram:HeaderTradeDeliveryType's fixed sequence: ..., ShipToTradeParty, ...,
  // ActualDeliverySupplyChainEvent, ...
  const delivery = fields.delivery ? renderShipTo(fields.delivery) : "";
  const actualDelivery = fields.delivery ? renderActualDelivery(fields.delivery) : "";
  const hasDelivery = delivery || actualDelivery;

  // ram:HeaderTradeSettlementType's fixed sequence: ..., InvoiceCurrencyCode, ...,
  // SpecifiedTradeSettlementPaymentMeans, ApplicableTradeTax, ..., SpecifiedTradeAllowanceCharge,
  // ..., SpecifiedTradePaymentTerms, SpecifiedTradeSettlementHeaderMonetarySummation, ...,
  // InvoiceReferencedDocument, ...
  const paymentMeans = fields.paymentMeans ? `\n${renderPaymentMeans(fields.paymentMeans)}` : "";
  const vatSubtotals = fields.vatSubtotals.map((bd) => renderVatSubtotal(bd)).join("\n");
  const documentAllowancesCharges = fields.allowancesCharges.length
    ? `\n${fields.allowancesCharges.map((ac) => renderAllowanceCharge(ac, "    ")).join("\n")}`
    : "";
  const paymentTerms = fields.dueDate
    ? `\n    <ram:SpecifiedTradePaymentTerms>\n      ${renderDateTime(fields.dueDate, "DueDateDateTime")}\n    </ram:SpecifiedTradePaymentTerms>`
    : "";
  // CII-DT-031: no currencyID here either — see renderVatSubtotal's note above.
  const prepaidAmount = fields.prepaidAmount
    ? `\n      <ram:TotalPrepaidAmount>${formatAmount(fields.prepaidAmount)}</ram:TotalPrepaidAmount>`
    : "";
  // BT-114: unlike UBL, CII puts RoundingAmount *before* GrandTotalAmount — between
  // TaxTotalAmount and GrandTotalAmount in TradeSettlementHeaderMonetarySummationType, even
  // though BR-CO-16 still adds it after the grand total (BT-115 = BT-112 − BT-113 + BT-114).
  const roundingAmount = fields.roundingAmount
    ? `\n        <ram:RoundingAmount>${formatAmount(fields.roundingAmount)}</ram:RoundingAmount>`
    : "";
  const invoiceReferencedDocument = fields.precedingInvoiceReference
    ? `\n${renderInvoiceReferencedDocument(fields.precedingInvoiceReference)}`
    : "";
// rsm = main CII document structure
// ram = reusable business structures
// udt = basic data types
// qdt = qualified data types
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>${businessProcess}
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>${GUIDELINE_ID[profile]}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(fields.id)}</ram:ID>
    <ram:TypeCode>${escapeXml(fields.typeCode)}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${dt102(fields.issueDate)}</udt:DateTimeString>
    </ram:IssueDateTime>${note}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${lines}
    <ram:ApplicableHeaderTradeAgreement>${buyerReference}
${renderParty("SellerTradeParty", fields.seller)}
${renderParty("BuyerTradeParty", fields.buyer)}${orderReference}${contractReference}
    </ram:ApplicableHeaderTradeAgreement>
    ${
      hasDelivery
        ? `<ram:ApplicableHeaderTradeDelivery>${delivery}${actualDelivery}\n    </ram:ApplicableHeaderTradeDelivery>`
        : "<ram:ApplicableHeaderTradeDelivery/>"
    }
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${currency}</ram:InvoiceCurrencyCode>${paymentMeans}
${vatSubtotals}${documentAllowancesCharges}${paymentTerms}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${formatAmount(fields.lineExtensionAmount)}</ram:LineTotalAmount>
        <ram:ChargeTotalAmount>${formatAmount(fields.chargeTotalAmount)}</ram:ChargeTotalAmount>
        <ram:AllowanceTotalAmount>${formatAmount(fields.allowanceTotalAmount)}</ram:AllowanceTotalAmount>
        <ram:TaxBasisTotalAmount>${formatAmount(fields.taxExclusiveAmount)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${currency}">${formatAmount(fields.taxAmount)}</ram:TaxTotalAmount>${roundingAmount}
        <ram:GrandTotalAmount>${formatAmount(fields.taxInclusiveAmount)}</ram:GrandTotalAmount>${prepaidAmount}
        <ram:DuePayableAmount>${formatAmount(fields.duePayableAmount)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>${invoiceReferencedDocument}
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}
