import { describe, it, expect } from "vitest";

import {
  checkCreditNoteAndCorrectionRequirements,
  type CreditNoteRuleFields,
} from "../rules/10.credit-note.js";
import type { EInvoiceProfile } from "../../core/types/profile.js";
import type { ValidationIssue } from "../types.js";

const reference = { id: "RE-2026-0042", issueDate: "2026-06-09" };
const paymentMeans = { code: "58", iban: "DE89370400440532013000" };

type Overrides = { [K in keyof CreditNoteRuleFields]?: CreditNoteRuleFields[K] | undefined };

/** A conventional positive credit note that satisfies every rule; tests override one field. */
function fields(overrides: Overrides = {}): CreditNoteRuleFields {
  return {
    typeCode: "381",
    duePayableAmount: 1190,
    dueDate: "2026-09-06",
    paymentMeans,
    precedingInvoiceReference: reference,
    ...overrides,
  } as CreditNoteRuleFields;
}

function check(
  overrides: Overrides = {},
  profile: EInvoiceProfile = "XRECHNUNG",
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  checkCreditNoteAndCorrectionRequirements(fields(overrides), profile, issues);
  return issues;
}

const codes = (issues: ValidationIssue[]): string[] => issues.map((i) => i.code);

/**
 * What's tested here (credit notes `381` and corrective invoices `384`):
 *
 * | typeCode | duePayableAmount | dueDate | paymentMeans | reference | Expected result                                  |
 * |----------|------------------|---------|--------------|-----------|---------------------------------------------------|
 * | 381      | positive         | present | present      | present   | no issue (the conventional form)                  |
 * | 381      | zero             | absent  | present      | present   | no issue                                          |
 * | 381      | negative         | absent  | present      | present   | CREDIT_NOTE_NEGATIVE_AMOUNT (warning)             |
 * | 381      | positive         | absent  | present      | present   | CREDIT_NOTE_DUE_DATE_REQUIRED (error)             |
 * | 381      | positive         | present | absent       | present   | CREDIT_NOTE_DUE_DATE_NOT_SERIALIZED, UBL only     |
 * | 381      | negative         | present | absent       | present   | negative warning and not-serialized warning (UBL) |
 * | 381      | any              | any     | any          | absent    | PRECEDING_INVOICE_REFERENCE_REQUIRED              |
 * | 384      | positive         | absent  | absent       | present   | no issue (unchanged: no sign or due date rule)    |
 * | 384      | positive         | any     | any          | absent    | PRECEDING_INVOICE_REFERENCE_REQUIRED              |
 * | 380      | positive         | absent  | absent       | absent    | no issue — checks don't apply                     |
 *
 * There is deliberately no mixed-sign rule: KoSIT and Mustang accept mixed-sign credit notes, and
 * Peppol BIS Billing 3.0 §5.6 neither allows nor forbids them. The mixed-sign cases below pin that.
 */
describe("checkCreditNoteAndCorrectionRequirements", () => {
  describe("positive credit note (the conventional form)", () => {
    it("accepts a positive 381 with a due date, payment means and a reference", () => {
      expect(check()).toEqual([]);
    });

    it("no longer rejects a positive duePayableAmount", () => {
      expect(codes(check({ duePayableAmount: 1190 }))).not.toContain("CREDIT_NOTE_POSITIVE_AMOUNT");
    });

    it("accepts a zero duePayableAmount without a due date", () => {
      expect(check({ duePayableAmount: 0, dueDate: undefined })).toEqual([]);
    });
  });

  describe("negative-amount credit note", () => {
    it("warns, and does not reject, a negative duePayableAmount", () => {
      const issues = check({ duePayableAmount: -1190, dueDate: undefined });
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        code: "CREDIT_NOTE_NEGATIVE_AMOUNT",
        severity: "warning",
        path: "duePayableAmount",
      });
    });

    it("does not require a due date when the amount is negative", () => {
      expect(codes(check({ duePayableAmount: -1190, dueDate: undefined }))).not.toContain(
        "CREDIT_NOTE_DUE_DATE_REQUIRED",
      );
    });
  });

  describe("due date (BR-CO-25, BT-9 or BT-20; only BT-9 is supported)", () => {
    it("requires dueDate when a positive credit note has none", () => {
      const issues = check({ dueDate: undefined });
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        code: "CREDIT_NOTE_DUE_DATE_REQUIRED",
        severity: "error",
        path: "dueDate",
      });
    });

    it("words the requirement as a current limitation, not as a universal rule", () => {
      const message = check({ dueDate: undefined })[0]!.message;
      expect(message).toContain("currently requires dueDate");
      expect(message).toContain("does not yet support payment terms");
    });

    it("applies the same way to the CII profile", () => {
      expect(codes(check({ dueDate: undefined }, "EN16931"))).toContain("CREDIT_NOTE_DUE_DATE_REQUIRED");
    });

    it("does not apply to a corrective invoice or a plain invoice", () => {
      expect(check({ typeCode: "384", dueDate: undefined })).toEqual([]);
      expect(check({ typeCode: "380", dueDate: undefined, precedingInvoiceReference: undefined })).toEqual([]);
    });
  });

  describe("dueDate without paymentMeans", () => {
    it("warns for UBL, because the date cannot be serialized", () => {
      const issues = check({ paymentMeans: undefined }, "XRECHNUNG");
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({ code: "CREDIT_NOTE_DUE_DATE_NOT_SERIALIZED", severity: "warning" });
    });

    it("says the XRechnung may still fail BR-DE-1", () => {
      const message = check({ paymentMeans: undefined })[0]!.message;
      expect(message).toContain("BR-DE-1");
      expect(message).toContain("only concerns the date");
    });

    it("is silent for CII, which carries the date without paymentMeans", () => {
      expect(check({ paymentMeans: undefined }, "EN16931")).toEqual([]);
    });

    it("does not apply to a plain invoice, which keeps the date in cbc:DueDate", () => {
      expect(check({ typeCode: "380", paymentMeans: undefined, precedingInvoiceReference: undefined })).toEqual([]);
    });
  });

  describe("preceding invoice reference (unchanged)", () => {
    it("flags a credit note with no precedingInvoiceReference", () => {
      expect(codes(check({ precedingInvoiceReference: undefined }))).toContain(
        "PRECEDING_INVOICE_REFERENCE_REQUIRED",
      );
    });

    it("flags a corrective invoice with no precedingInvoiceReference", () => {
      expect(codes(check({ typeCode: "384", precedingInvoiceReference: undefined }))).toContain(
        "PRECEDING_INVOICE_REFERENCE_REQUIRED",
      );
    });

    it("accepts a corrective invoice with a positive duePayableAmount when a reference is present", () => {
      expect(check({ typeCode: "384", dueDate: undefined, paymentMeans: undefined })).toEqual([]);
    });

    it("does not apply any check to a plain invoice (380)", () => {
      expect(
        check({ typeCode: "380", dueDate: undefined, paymentMeans: undefined, precedingInvoiceReference: undefined }),
      ).toEqual([]);
    });
  });
});
