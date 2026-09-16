// Validators enforce correctness before an invoice reaches an output adapter.
// Two layers are planned:
//   SchemaValidator    → structural completeness (required fields, types)
//   BusinessRuleValidator → legal rules (VAT consistency, rounding, §13b requirements)

export { validateBusinessRules } from "./engines/02.business-rules.js";
export type { ValidationIssue } from "./engines/02.business-rules.js";

export { runKosit } from "./engines/90.kosit.js";
export type { KositIssue, KositResult, KositOptions } from "./engines/90.kosit.js";

export { runVeraPdf } from "./engines/91.vera-pdf.js";
export type { VeraPdfIssue, VeraPdfResult, VeraPdfOptions } from "./engines/91.vera-pdf.js";

export { runMustang, extractWithMustang } from "./engines/92.mustang.js";
export type { MustangIssue, MustangResult, MustangOptions } from "./engines/92.mustang.js";

export {
  SUGGESTED_FIXES,
  fromValidationIssue,
  fromKositIssue,
  fromVeraPdfIssue,
  fromMustangIssue,
} from "./engines/99.compliance-issue.js";
export type { ComplianceIssue, ComplianceSource } from "./engines/99.compliance-issue.js";
