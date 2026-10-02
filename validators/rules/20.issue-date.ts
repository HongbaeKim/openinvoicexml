import type { ValidationIssue } from "../types.js";

/**
 * Warns when the invoice issue date (BT-2) is in the future.
 *
 * EN 16931 and §14 UStG do not forbid a future issue date, so this is a warning, not an error.
 * It may still be a typo, so it is useful to tell the user.
 *
 * Invalid date formats are handled by schema validation.
 */
export function checkIssueDateNotInFuture(
  issueDate: string,
  today: string,
  issues: ValidationIssue[],
): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) return;
  if (issueDate <= today) return;

  issues.push({
    code: "ISSUE_DATE_IN_FUTURE",
    severity: "warning",
    message: `issueDate: BT-2 issue date ${issueDate} is later than today (${today}). Check for a typo; a future-dated invoice is legal but unusual.`,
    path: "issueDate",
  });
}
