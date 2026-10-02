import { createRequire } from "node:module";
import { Ajv } from "ajv";
import type { ErrorObject, ValidateFunction } from "ajv";
import schema from "../../schemas/invoice.schema.json" with { type: "json" };
import type { ValidationIssue } from "../types.js";

// Node-only: AJV uses `new Function()` to compile the schema, which may be blocked by
// strict browser security rules. 
// browser.test.ts ensures it is not included in the browser build.

// Load ajv-formats with require() because its default import causes a TypeScript error
// with our NodeNext setup.
const require = createRequire(import.meta.url);
// Loads ajv-formats for checks like "date" and "date-time".
// Without the type:
// TypeScript doesn't clearly know the type
// const addFormats = require("ajv-formats");

// With the type:
// Input: an Ajv instance
// Output: nothing (void)
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const addFormats: (ajv: InstanceType<typeof Ajv>) => void = require("ajv-formats");

// Returns a function that checks an object against the invoice schema.
// Compiles the schema only the first time, then reuses it for speed.
// Returns true/false and stores validation problems in validate.errors.
let compiled: ValidateFunction | undefined;

function getValidator(): ValidateFunction {
  if (compiled === undefined) {
    // allErrors: report every problem in one pass instead of stopping at the first one.
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    compiled = ajv.compile(schema as object);
  }
  return compiled;
}

/** 
 * "/lines/0/vatRate" 
 *         → 
 * "lines[0].vatRate", 
 * matching the paths validateBusinessRules() reports. */
function toIssuePath(pointer: string): string {
  return pointer
    // "/lines/0/vatRate" → ["", "lines", "0", "vatRate"]
    .split("/")
    // Remove the first empty item → ["lines", "0", "vatRate"]
    .slice(1)
    // Decode JSON Pointer characters like "~1" → "/" and "~0" → "~"
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"))
    // Build a readable path: ["lines", "0", "vatRate"] → "lines[0].vatRate"
    .reduce((path, segment) => {
      if (/^\d+$/.test(segment)) return `${path}[${segment}]`;
      return path === "" ? segment : `${path}.${segment}`;
    }, "");
}

function toValidationIssue(error: ErrorObject): ValidationIssue {
  let path = toIssuePath(error.instancePath);
  // For `required` / `additionalProperties` AJV points at the parent object, so name the
  // offending property too; otherwise two different missing fields would look identical.
  const params = error.params as { missingProperty?: string; additionalProperty?: string };
  const property = params.missingProperty ?? params.additionalProperty;
  if (property !== undefined) {
    if (path === "") {
      path = property;
    } else {
      path = `${path}.${property}`;
    }
  }

  return {
    code: `SCHEMA_${error.keyword.toUpperCase()}`,
    severity: "error",
    message: `${path === "" ? "Invoice" : path} ${error.message ?? "is invalid"}`,
    path,
  };
}

/**
 * Checks if `data` has the correct Invoice structure.
 * It checks required fields, types, formats, allowed values, and unknown fields.
 *
 * It does not check VAT calculations or legal business rules.
 * Those are checked later by validateBusinessRules().
 *
 * Accepts `unknown` so it can safely check untyped input like parsed JSON or form data.
 * It never throws. It returns validation issues, or an empty array if everything is valid.
 */
export function validateInvoiceSchema(data: unknown): ValidationIssue[] {
  const validate = getValidator();

  const isValid = validate(data);

  if (isValid) {
    return [];
  }

  const errors = validate.errors ?? [];
  const issues = errors.map((error) => toValidationIssue(error));

  return issues;
}
