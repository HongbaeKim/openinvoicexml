// Validators enforce correctness before an invoice reaches an output adapter.
// Two layers are planned:
//   SchemaValidator    → structural completeness (required fields, types)
//   BusinessRuleValidator → legal rules (VAT consistency, rounding, §13b requirements)
