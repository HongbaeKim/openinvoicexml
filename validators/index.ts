// Validators enforce correctness before an invoice reaches an output adapter.
// Two layers are planned:
//   SchemaValidator    → structural completeness (required fields, types)
//   BusinessRuleValidator → legal rules (VAT consistency, rounding, §13b requirements)

export { validateBusinessRules } from "./business-rules.js";
export type { ValidationIssue } from "./business-rules.js";

export { runKosit } from "./kosit.js";
export type { KositIssue, KositResult, KositOptions } from "./kosit.js";
