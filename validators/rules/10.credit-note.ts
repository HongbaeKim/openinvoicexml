import type { Invoice } from "../../core/types/invoice.js";
import type { EInvoiceProfile } from "../../core/types/profile.js";
import type { ValidationIssue } from "../types.js";

/** The invoice fields the credit-note and corrective-invoice rules read. */
export type CreditNoteRuleFields = Pick<
  Invoice,
  "typeCode" | "duePayableAmount" | "dueDate" | "paymentMeans" | "precedingInvoiceReference"
>;

/**
 * Checks document-type-specific requirements for credit notes (`typeCode` `381`) and
 * corrective invoices (`typeCode` `384`).
 *
 * The sign of a `381` is not restricted: Peppol BIS Billing 3.0 §5.6 says crediting is controlled
 * by the document type and that the sign of the amounts is not affected, and KoSIT and Mustang
 * accept positive, negative and mixed-sign credit notes. A negative amount due only gets a warning,
 * because a recipient may book a negative-amount `381` as a debit.
 *
 * @see ../../docs/COMPLIANCE.md for this rule's status.
 */
export function checkCreditNoteAndCorrectionRequirements(
  fields: CreditNoteRuleFields,
  profile: EInvoiceProfile,
  issues: ValidationIssue[],
): void {
  const { typeCode, duePayableAmount, dueDate, paymentMeans, precedingInvoiceReference } = fields;

  if (typeCode === "381" && duePayableAmount < 0) {
    issues.push({
      code: "CREDIT_NOTE_NEGATIVE_AMOUNT",
      severity: "warning",
      message:
        `duePayableAmount: BT-115 amount ${duePayableAmount} is negative on a credit note (typeCode '381'). ` +
        "The document type already expresses the credit, so this credits a negative amount and a recipient " +
        "may book it as a debit. Use positive amounts for a conventional credit note.",
      path: "duePayableAmount",
    });
  }

  // BR-CO-25 (EN 16931): a positive BT-115 needs a payment due date (BT-9) or payment terms
  // (BT-20). OpenInvoiceXML has no BT-20 support, so dueDate is the only way to satisfy it. The
  // installed KoSIT checks this for CII but not for a UBL CreditNote, so the rule is applied to
  // both formats to keep one input contract.
  if (typeCode === "381" && duePayableAmount > 0 && !dueDate) {
    issues.push({
      code: "CREDIT_NOTE_DUE_DATE_REQUIRED",
      severity: "error",
      message:
        `dueDate: BT-9 payment due date is missing for a credit note (typeCode '381') with a positive ` +
        `duePayableAmount (${duePayableAmount}). EN 16931 BR-CO-25 requires BT-9 or payment terms (BT-20); ` +
        "OpenInvoiceXML currently requires dueDate because it does not yet support payment terms.",
      path: "dueDate",
    });
  }

  // A UBL CreditNote has no cbc:DueDate; BT-9 goes in cac:PaymentMeans/cbc:PaymentDueDate, which
  // needs a PaymentMeans to live in. CII always carries the date.
  if (typeCode === "381" && dueDate && !paymentMeans && profile === "XRECHNUNG") {
    issues.push({
      code: "CREDIT_NOTE_DUE_DATE_NOT_SERIALIZED",
      severity: "warning",
      message:
        "dueDate: BT-9 cannot be written to a UBL credit note (typeCode '381') without paymentMeans, so it is " +
        "left out of the XML. This only concerns the date: without paymentMeans the XRechnung can still " +
        "fail BR-DE-1 (payment instructions are mandatory).",
      path: "dueDate",
    });
  }

  // A corrective invoice (384) that doesn't say what it corrects is as meaningless as a
  // credit note that doesn't say what it credits — enforced for both, not just 381.
  if ((typeCode === "381" || typeCode === "384") && !precedingInvoiceReference) {
    issues.push({
      code: "PRECEDING_INVOICE_REFERENCE_REQUIRED",
      severity: "error",
      message: `precedingInvoiceReference: BT-25/BT-26 reference to the preceding invoice is required for typeCode '${typeCode}'.`,
      path: "precedingInvoiceReference",
    });
  }
}
