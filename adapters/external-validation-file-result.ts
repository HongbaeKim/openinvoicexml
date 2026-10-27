// Builds FileValidationResult objects for the existing-file validators: not-applicable
// validators, the overall PASS / FAIL / UNAVAILABLE status and the unsupported-file result.

import { issuesOf, type ExternalValidatorResult } from "./external-validation.js";
import type {
  FileFinding,
  FileValidationResult,
  FileValidationStatus,
  ResultBase,
  ValidatorSet,
} from "./external-validation-file-types.js";

/**
 * Returns a validator result when that validator
 * does not apply to this file.
 */
export function notApplicable(reason: string): ExternalValidatorResult {
  return {
    applicable: false,
    reason,
  };
}

/** KoSIT and Mustang both not applicable, for the same reason. */
export function bothNotApplicable(reason: string): Pick<ValidatorSet, "kosit" | "mustang"> {
  return { kosit: notApplicable(reason), mustang: notApplicable(reason) };
}

/**
 * Decides the final PASS / FAIL / UNAVAILABLE status.
 */
function overallStatus(
  fileFindings: FileFinding[],
  validators: ExternalValidatorResult[],
): FileValidationStatus {
  // A file problem means FAIL.
  if (fileFindings.length > 0) {
    return "FAIL";
  }

  // Look only at validators that apply to this file.
  const applicableValidators = validators.filter(
    (validator) => validator.applicable,
  );

  // A validator ran and found a problem.
  const hasFailedValidator = applicableValidators.some(
    (validator) => validator.ran && !validator.valid,
  );

  if (hasFailedValidator) {
    return "FAIL";
  }

  // No validator applies.
  if (applicableValidators.length === 0) {
    return "UNAVAILABLE";
  }

  // A validator should run, but could not run.
  const hasUnavailableValidator = applicableValidators.some(
    (validator) => !validator.ran,
  );

  if (hasUnavailableValidator) {
    return "UNAVAILABLE";
  }

  // Everything that should run passed.
  return "PASS";
}

/**
 * Combines everything into the final validation result.
 */
export function finish(base: ResultBase, validators: ValidatorSet): FileValidationResult {
  const { kosit, mustang, veraPdf } = validators;
  return {
    status: overallStatus(base.fileFindings, [kosit, mustang, veraPdf]),
    ...base,
    kosit,
    mustang,
    veraPdf,
    complianceIssues: [...issuesOf(kosit), ...issuesOf(mustang), ...issuesOf(veraPdf)],
  };
}

/**
 * Returns a result for a file that is not XML or PDF.
 * No validators run.
 */
export function unsupportedResult(): FileValidationResult {
  const reason = "The file is neither XML nor PDF.";

  const validators = bothNotApplicable(reason);

  const result = finish(
    {
      detectedFormat: "UNKNOWN",
      fileFindings: [],
    },
    {
      kosit: validators.kosit,
      mustang: validators.mustang,
      veraPdf: notApplicable(reason),
    },
  );

  return {
    ...result,
    status: "UNSUPPORTED",
  };
}
