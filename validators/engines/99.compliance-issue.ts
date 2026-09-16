import type { ValidationIssue } from "../types.js";
import type { KositIssue } from "./90.kosit.js";
import type { VeraPdfIssue } from "./91.vera-pdf.js";
import type { MustangIssue } from "./92.mustang.js";

/** Which validator originally produced a `ComplianceIssue`. */
export type ComplianceSource = "business-rules" | "kosit" | "vera-pdf" | "mustang";

/**
 * Converts ValidationIssue, KositIssue, VeraPdfIssue, and MustangIssue into one shared format.
 *
 * This makes it easier to handle errors from different validators in the same way.
 *
 * `source` shows where the error came from.
 *
 * `suggestedFix` is only added for our own ValidationIssue errors because we know
 * exactly what those errors mean.
 *
 * For KoSIT, veraPDF, and Mustang, we keep the original error message and do not guess a fix,
 * because their messages can change between versions and a guessed fix could be wrong.
 */
export interface ComplianceIssue extends ValidationIssue {
  source: ComplianceSource;
  suggestedFix?: string;
}

/**
 * Stores one suggested fix for each ValidationIssue code created by Openinvoicexml.
 *
 * It includes all validation codes currently used in:
 * `validators/02.business-rules.ts` and `validators/rules/*.ts`.
 *
 * This covers the older rounding and VAT checks, plus the newer rules for
 * §19, §13b, K/G, credit notes, down payments, and allowances/charges.
 *
 * The fixes are stored by `code` because ComplianceIssue also uses `code`
 * to identify each validation problem.
 */
export const SUGGESTED_FIXES: Record<string, string> = {
  // --- validators/02.business-rules.ts (own inline checks) -----------------------------------
  LINE_AMOUNT_ROUNDING:
    "Set lineAmount to quantity × unitPrice (adjusted for any line-level allowance/charge).",
  REVERSE_CHARGE_BUYER_VAT_ID_REQUIRED:
    "Set buyer.vatId (BT-48) — required whenever VAT category 'AE' (§13b UStG reverse charge) is used.",
  PRECEDING_INVOICE_REFERENCE_REQUIRED:
    "Set precedingInvoiceReference (BT-25/BT-26) to the id/issueDate of the invoice this document credits, corrects, or deducts a down payment from.",
  VAT_EXEMPTION_REASON_REQUIRED:
    "Set exemptionReason or exemptionReasonCode (BT-120/BT-121) — required for VAT categories E/AE/K/G/O.",
  VAT_EXEMPTION_REASON_NOT_ALLOWED:
    "Remove the exemption reason (BT-120/BT-121) — categories 'S' and 'Z' must not carry one.",
  VAT_BREAKDOWN_RATE_MISMATCH:
    "Add a line at this category/rate, or remove the unmatched VAT breakdown entry.",
  VAT_TAXABLE_AMOUNT_MISMATCH:
    "Set the breakdown's taxableAmount to the sum of matching line amounts, adjusted for any document-level allowance/charge at the same category/rate.",
  VAT_TAX_AMOUNT_ROUNDING: "Set the breakdown's taxAmount to taxableAmount × rate.",
  INVOICE_TAX_EXCLUSIVE_AMOUNT_MISMATCH:
    "Set taxExclusiveAmount (BT-109) to the sum of every VAT breakdown's taxableAmount.",
  INVOICE_TAX_AMOUNT_MISMATCH: "Set taxAmount (BT-110) to the sum of every VAT breakdown's taxAmount.",
  INVOICE_TAX_INCLUSIVE_AMOUNT_MISMATCH:
    "Set taxInclusiveAmount (BT-112) to taxExclusiveAmount plus taxAmount.",
  INVOICE_DUE_PAYABLE_AMOUNT_MISMATCH:
    "Set duePayableAmount (BT-115) to taxInclusiveAmount minus prepaidAmount.",
  MONETARY_AMOUNT_DECIMAL_PRECISION: "Round the amount to at most 2 decimal places.",
  PLACE_OF_SUPPLY_CROSS_BORDER:
    "Warning only, no field is necessarily wrong — verify by hand whether the seller's or buyer's country governs place of supply for this cross-border transaction.",

  // --- validators/rules/10.credit-note.ts -----------------------------------------------------
  CREDIT_NOTE_POSITIVE_AMOUNT:
    "Make duePayableAmount (BT-115) zero or negative — required for a credit note (typeCode '381').",

  // --- validators/rules/11.delivery.ts --------------------------------------------------------
  DELIVERY_COUNTRY_REQUIRED:
    "Set delivery.deliverTo.countryCode (BT-80) whenever a deliver-to address (BG-15) is supplied.",

  // --- validators/rules/12.export.ts ----------------------------------------------------------
  EXPORT_BUYER_COUNTRY_MUST_BE_NON_EU:
    "Move the buyer outside the EU, or use a different VAT category — 'G' (export) requires a non-EU buyer address.",
  EXPORT_EXEMPTION_REASON_INVALID:
    "Reference the export delivery exemption (§4 Nr. 1 Buchst. a UStG), or set exemptionReasonCode to 'VATEX-EU-G'.",

  // --- validators/rules/13.intra-eu.ts --------------------------------------------------------
  INTRA_EU_SUPPLY_SELLER_VAT_ID_REQUIRED:
    "Set seller.vatId (BT-31) — required for VAT category 'K' (intra-EU supply).",
  INTRA_EU_SUPPLY_SELLER_VAT_ID_INVALID_FORMAT:
    "Correct seller.vatId (BT-31) to match the VAT identifier format for the seller's country.",
  INTRA_EU_SUPPLY_BUYER_VAT_ID_REQUIRED:
    "Set buyer.vatId (BT-48) — required for VAT category 'K' (intra-EU supply).",
  INTRA_EU_SUPPLY_BUYER_VAT_ID_INVALID_FORMAT:
    "Correct buyer.vatId (BT-48) to match the VAT identifier format for the buyer's country.",
  INTRA_EU_SUPPLY_SELLER_COUNTRY_NOT_EU:
    "Move the seller into an EU member state — category 'K' (intra-EU supply) requires it.",
  INTRA_EU_SUPPLY_BUYER_COUNTRY_NOT_EU:
    "Move the buyer into an EU member state — category 'K' (intra-EU supply) requires it.",
  INTRA_EU_SUPPLY_COUNTRY_MISMATCH:
    "Put the seller and buyer in different EU member states — category 'K' doesn't apply to a domestic transaction.",
  INTRA_EU_SUPPLY_DELIVERY_DATE_REQUIRED:
    "Set delivery.actualDeliveryDate (BT-72) — required for VAT category 'K' (intra-EU supply) per BR-IC-11.",
  INTRA_EU_SUPPLY_DELIVERY_COUNTRY_REQUIRED:
    "Set delivery.deliverTo.countryCode (BT-80) — required for VAT category 'K' (intra-EU supply) per BR-IC-12.",
  INTRA_EU_SUPPLY_DELIVERY_COUNTRY_MATCHES_SELLER:
    "Deliver the goods to a different country than the seller's own — category 'K' requires the goods to actually leave the seller's country.",
  INTRA_EU_SUPPLY_EXEMPTION_REASON_INVALID:
    "Reference §6a UStG / intra-community supply, or set exemptionReasonCode to 'VATEX-EU-IC'.",

  // --- validators/rules/14.outside-scope.ts ---------------------------------------------------
  OUTSIDE_SCOPE_VAT_ID_FORBIDDEN:
    "Remove seller.vatId/buyer.vatId — neither may be present on an invoice with any VAT category 'O' line (BR-O-02).",

  // --- validators/rules/15.reverse-charge.ts --------------------------------------------------
  REVERSE_CHARGE_REASON_REQUIRES_AE_CATEGORY:
    "Remove reverseChargeReason, or change the VAT category to 'AE' — a §13b subcase tag only applies to reverse-charge breakdowns.",
  REVERSE_CHARGE_SUBCASE_EXEMPTION_REASON_INVALID:
    "Reword the exemption reason to reference the declared reverseChargeReason subcase specifically, not just generic reverse-charge wording.",

  // --- validators/rules/16.small-business.ts --------------------------------------------------
  SMALL_BUSINESS_TAX_ID_REQUIRED:
    "Set seller.taxRegistrationId (BT-32) or seller.vatId (BT-31) — required for a §19 UStG small-business exemption.",

  // --- validators/rules/17.vat-rate.ts --------------------------------------------------------
  VAT_RATE_INVALID_FOR_CATEGORY:
    "Set the rate to 19 or 7 for category 'S', or to 0 for every other zero-rate category.",

  // --- validators/rules/18.allowance-charge.ts ------------------------------------------------
  ALLOWANCE_CHARGE_REASON_REQUIRED:
    "Set reason or reasonCode (BT-97/104 document-level, BT-139/144 line-level) on every allowance/charge.",
  DOCUMENT_ALLOWANCE_CHARGE_VAT_CATEGORY_REQUIRED:
    "Set vatCategoryCode (BT-95/102) on every document-level allowance/charge.",
  DOCUMENT_ALLOWANCE_CHARGE_VAT_RATE_REQUIRED:
    "Set vatRate (BT-96/103) on the document-level allowance/charge — required for every VAT category except 'O'.",
  DOCUMENT_ALLOWANCE_CHARGE_VAT_RATE_NOT_ALLOWED:
    "Remove vatRate (BT-96/103) — it must be absent when the document-level allowance/charge's VAT category is 'O'.",
  DOCUMENT_ALLOWANCE_CHARGE_VAT_RATE_INVALID_FOR_CATEGORY:
    "Set vatRate (BT-96/103) to 19 or 7 for category 'S', or to 0 for every other category.",

  // --- validators/rules/19.xrechnung-mandatory-fields.ts --------------------------------------
  XRECHNUNG_BUYER_REFERENCE_REQUIRED:
    "Set buyerReference (BT-10) — mandatory under the XRechnung 3.0 CIUS even though EN 16931 itself leaves it optional.",
};

/** Converts Openinvoicexml's own `ValidationIssue` into a `ComplianceIssue`, looking up a fix by code. */
export function fromValidationIssue(issue: ValidationIssue): ComplianceIssue {
  const suggestedFix = SUGGESTED_FIXES[issue.code];
  return suggestedFix === undefined
    ? { ...issue, source: "business-rules" }
    : { ...issue, source: "business-rules", suggestedFix };
}

/**
 * KoSIT puts its rule code at the start of the message, like "[CODE] ...".
 *
 * We read that code directly from the message instead of guessing it.
 *
 * If no rule code is found, we use a general fallback code.
 * This can happen for messages like "no scenario matched", which are not linked
 * to one specific Schematron rule.
 */
const KOSIT_CODE_PATTERN = /^\[([^\]]+)\]/;

/**
 * Converts a KositIssue into a ComplianceIssue.
 *
 * KoSIT's `location` becomes `path`.
 * We keep the XPath as it is because it points to the generated XML,
 * not to the original Invoice object.
 *
 * KoSIT uses three severity levels, but Openinvoicexml uses only two.
 * So "information" is converted to "warning".
 *
 * This is safe because "information" is only a recommendation
 * and does not block the invoice.
 */
export function fromKositIssue(issue: KositIssue): ComplianceIssue {
  return {
    code: KOSIT_CODE_PATTERN.exec(issue.message)?.[1] ?? "KOSIT",
    severity: issue.severity === "information" ? "warning" : issue.severity,
    message: issue.message,
    path: issue.location ?? "",
    source: "kosit",
  };
}

/**
 * veraPDF messages use this format: "clause: message".
 *
 * We take the clause number and use it as the `code`.
 *
 * The code comes directly from veraPDF's own output,
 * so we are reading it, not guessing it.
 */
const VERA_PDF_CODE_PATTERN = /^([\d.]+):/;

/**
 * Converts a VeraPdfIssue into a ComplianceIssue.
 *
 * veraPDF only reports errors, not warnings.
 * So we can keep the severity as "error" without changing it.
 */
export function fromVeraPdfIssue(issue: VeraPdfIssue): ComplianceIssue {
  return {
    code: VERA_PDF_CODE_PATTERN.exec(issue.message)?.[1] ?? "VERA_PDF",
    severity: issue.severity,
    message: issue.message,
    path: issue.location ?? "",
    source: "vera-pdf",
  };
}

/**
 * Converts a MustangIssue into a ComplianceIssue.
 *
 * The `code` comes from Mustang's `ruleTest` value (read from the tool's own `criterion="..."`
 * XML attribute — the Schematron rule's XPath test).
 * We use this value directly instead of guessing a code from the message text.
 *
 * Some Mustang schema errors do not have a `ruleTest`.
 * In that case, we use a general fallback code.
 *
 * Mustang's "information" level is converted to "warning"
 * because it is a non-blocking message.
 */
export function fromMustangIssue(issue: MustangIssue): ComplianceIssue {
  return {
    code: issue.ruleTest ?? "MUSTANG",
    severity: issue.severity === "information" ? "warning" : issue.severity,
    message: issue.message,
    path: issue.location ?? "",
    source: "mustang",
  };
}
