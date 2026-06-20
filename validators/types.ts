/** A single business-rule violation found in an invoice. */
export interface ValidationIssue {
  /** Machine-readable rule identifier. */
  code: string;
  /** "error" blocks compliant output; "warning" is informational. */
  severity: "error" | "warning";
  /** Human-readable description, referencing the relevant BT/BG code. */
  message: string;
  /** Location of the offending field, e.g. "lines[1].vatRate" or "vatBreakdowns[0]". */
  path: string;
}
