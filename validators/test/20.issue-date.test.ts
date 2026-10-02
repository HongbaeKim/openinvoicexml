import { describe, it, expect } from "vitest";

import { checkIssueDateNotInFuture } from "../rules/20.issue-date.js";
import { validateBusinessRules } from "../engines/02.business-rules.js";
import type { ValidationIssue } from "../types.js";
import type { Invoice } from "../../core/index.js";
import { domesticSimple } from "../../fixtures/index.js";

function check(issueDate: string, today: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  checkIssueDateNotInFuture(issueDate, today, issues);
  return issues;
}

describe("checkIssueDateNotInFuture", () => {
  it("warns when the issue date is after today", () => {
    expect(check("2026-06-10", "2026-06-09")).toEqual([
      expect.objectContaining({
        code: "ISSUE_DATE_IN_FUTURE",
        severity: "warning",
        path: "issueDate",
      }),
    ]);
  });

  it("does not warn when the issue date is today", () => {
    expect(check("2026-06-09", "2026-06-09")).toEqual([]);
  });

  it("does not warn when the issue date is in the past", () => {
    expect(check("2026-06-08", "2026-06-09")).toEqual([]);
  });

  it("skips malformed dates; the schema layer reports those", () => {
    expect(check("not-a-date", "2026-06-09")).toEqual([]);
  });
});

describe("validateBusinessRules: future issue date", () => {
  const invoice = domesticSimple as Invoice; // issueDate 2026-06-09

  it("adds the warning, never an error, using the injected date", () => {
    const issues = validateBusinessRules(invoice, "XRECHNUNG", { today: "2026-06-01" });
    const future = issues.filter((i) => i.code === "ISSUE_DATE_IN_FUTURE");
    expect(future).toHaveLength(1);
    expect(issues.some((i) => i.severity === "error")).toBe(false);
  });

  it("is silent when today is on or after the issue date", () => {
    const issues = validateBusinessRules(invoice, "XRECHNUNG", { today: "2026-06-09" });
    expect(issues.some((i) => i.code === "ISSUE_DATE_IN_FUTURE")).toBe(false);
  });

  it("defaults to the current date when no date is injected", () => {
    const farFuture: Invoice = { ...invoice, issueDate: "2999-01-01" };
    expect(
      validateBusinessRules(farFuture, "XRECHNUNG").some((i) => i.code === "ISSUE_DATE_IN_FUTURE"),
    ).toBe(true);
  });
});
