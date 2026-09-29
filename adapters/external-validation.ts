// External validation: XML/PDF bytes → KoSIT / Mustang / veraPDF result. Node-only (Java child
// processes, temp files).
//
// Kept separate from generate-invoice.ts (Invoice → XML): this module never builds an invoice,
// it only checks bytes someone else produced — generateInvoice()'s own output, the exact XML a
// browser generated with generateInvoiceXml() and sent to a validation backend, or an existing
// invoice file a user uploaded.
// Must never be reachable from adapters/browser.ts (browser.test.ts enforces that).
//
// Split across three files:
// - external-validation.ts        — XML → KoSIT + Mustang, and the runner helpers the others share
// - external-validation-detect.ts — detectInvoiceFormat(): what a file is, from content only
// - external-validation-file.ts   — validateFileExternally(): an uploaded XML or PDF, as given
//
//
// validateXmlExternally(xml)
//           ↓
// withTempXmlFile()
//           ↓
// save temporary invoice.xml
//           ↓
// validateTemporaryXml(xmlPath)
//           ↓
//     ┌───────────────┐
//     │               │
//  run KoSIT      run Mustang
//     │               │
//     ↓               ↓
// KoSIT result    Mustang result
//     │               │
//     └───────┬───────┘
//             ↓
//       collect issues
//             ↓
//    add KoSIT scenario
//             ↓
//      build final result
//             ↓
// withTempXmlFile deletes temp folder
//             ↓
//        return result

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  runKosit,
  type KositIssue,
  type KositOptions,
  type KositResult,
} from "../validators/engines/90.kosit.js";
import { runMustang, type MustangOptions } from "../validators/engines/92.mustang.js";
import {
  fromKositIssue,
  fromMustangIssue,
  type ComplianceIssue,
} from "../validators/engines/99.compliance-issue.js";

/**
 * One validator's outcome. Three distinct cases:
 *
 * - `applicable: false` — this validator doesn't apply (e.g. veraPDF for an XML file). `reason`
 *   says why. Display-only: it never affects an overall result, and it is never "unavailable".
 * 
 * - `ran: false` — the validator should have run but the infrastructure prevented it (Java or
 *   jar missing, unreadable report, process killed, ...). `error` says why. This is neither a
 *   pass nor a fail: callers must report it as "unavailable", never as a validation result.
 * 
 * - `ran: true` — the validator completed and its report was parsed. `valid` is true only if
 *   the validator's own verdict is accept (KoSIT `<rep:accept>`, Mustang
 *   `<summary status="valid"/>`, veraPDF `isCompliant="true"`) AND it reported zero
 *   error-severity findings. `issues` are this validator's findings.
 */
export type ExternalValidatorResult =
  | { applicable: false; reason: string }
  | { applicable: true; ran: false; valid: false; error: string }
  | { applicable: true; ran: true; valid: boolean; issues: ComplianceIssue[] };

/** A validator result for a validator that always applies (KoSIT and Mustang on XML). */
export type ApplicableValidatorResult = Extract<ExternalValidatorResult, { applicable: true }>;

export interface ExternalValidationResult {
  kosit: ApplicableValidatorResult;
  mustang: ApplicableValidatorResult;
  /** The KoSIT scenario the XML matched, when KoSIT ran and one matched. */
  kositScenario?: string;
  /** KoSIT findings first, then Mustang's; empty for a validator that didn't run. */
  complianceIssues: ComplianceIssue[];
}

export interface ExternalValidationOptions {
  // Take KositOptions, and remove outDir
  kosit?: Omit<KositOptions, "outDir">;
  mustang?: MustangOptions;
}

/**
 * Saves the XML to a temporary file, calls `fn` with the file path,
 * then deletes the temporary folder.
 *
 * `Uint8Array` is written without changing its bytes.
 * A string is written as UTF-8.
 * `prefix` sets the beginning of the temporary folder name.
 *
 * Flow:
 * JavaScript has XML
 *        ↓
 * Save it as a temporary file
 *        ↓
 * /tmp/.../invoice.xml
 *        ↓
 * Give the file path to KoSIT / Mustang
 *        ↓
 * Validator checks it
 *        ↓
 * Delete the temporary folder
 */

// fn can return somthing, and this fundcion will return that same type
export function withTempXmlFile<T>(
  xml: string | Uint8Array,
  fn: (xmlPath: string) => T,
  prefix = "external-validation-",
): T {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  try {
    const xmlPath = join(dir, "invoice.xml");
    if (typeof xml === "string") 
      writeFileSync(xmlPath, xml, "utf8");
    else 
      writeFileSync(xmlPath, xml);
    return fn(xmlPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Runs KoSIT on one XML file.
 *
 * KoSIT needs a file path, so `xmlPath` tells KoSIT where the XML file is.
 * The KoSIT report is saved in the same folder as the XML file.
 * This lets the XML file and KoSIT report be deleted together later.
 */
function runKositOnFile(
  xmlPath: string,
  options: ExternalValidationOptions["kosit"],
): KositResult {
  // KoSIT accepts a list of XML files, so put our one file into a list.
  const xmlFiles = [xmlPath];

  // Get the folder that contains the XML file.
  const outputDirectory = dirname(xmlPath);

  // Keep the given KoSIT options and tell KoSIT where to save its report.
  const kositOptions = {
    ...options,
    outDir: outputDirectory,
  };

  // Run KoSIT. It returns a list of results because it can check multiple files.
  const results = runKosit(xmlFiles, kositOptions);

  // We checked only one XML file, so get the first result.
  const result = results[0];

  // Something went wrong if KoSIT did not give us a result.
  if (!result) {
    throw new Error("KoSIT returned no result.");
  }

  return result;
}

/**
 * Checks XML with KoSIT and returns the issues KoSIT found.
 *
 * This is used by `generateInvoice({ validateExternally: true })`.
 * It only runs KoSIT.
 * Use `validateXmlExternally()` when both KoSIT and Mustang are needed.
 */
export function runKositAgainstXml(xml: string): KositIssue[] {
  // This function will be called after the temporary XML file is created.
  const runKositAndGetIssues = (xmlPath: string): KositIssue[] => {
    // Run KoSIT on the temporary XML file.
    const result = runKositOnFile(xmlPath, undefined);

    // We only need the issues from the KoSIT result.
    return result.issues;
  };

  // Save the XML to a temporary file, run KoSIT on it,
  // then delete the temporary folder.
  const issues = withTempXmlFile(
    xml,
    runKositAndGetIssues,
    "generate-invoice-kosit-",
  );

  return issues;
}

/**
 * Tries to run a validator.
 *
 * If the validator runs, returns its validation result.
 * If the validator throws an error, returns `ran: false` with the error message.
 */
export function attempt(
  run: () => { valid: boolean; issues: ComplianceIssue[] },
): ApplicableValidatorResult {
  try {
    // Run the validator.
    const result = run();

    const valid = result.valid;
    const issues = result.issues;

    // Check if the validator found at least one error.
    const hasErrors = issues.some((issue) => {
      return issue.severity === "error";
    });

    // The file passes only when the validator says it is valid
    // and there are no error-level issues.
    const passed = valid && !hasErrors;

    return {
      applicable: true,
      ran: true,
      valid: passed,
      issues: issues,
    };
  } catch (err) {
    // The validator could not run.
    let errorMessage: string;

    if (err instanceof Error) {
      errorMessage = err.message;
    } else {
      errorMessage = String(err);
    }

    return {
      applicable: true,
      ran: false,
      valid: false,
      error: errorMessage,
    };
  }
}

/**
 * Returns the issues found by a validator.
 * Returns an empty list if the validator did not run.
 */
export function issuesOf(
  result: ExternalValidatorResult,
): ComplianceIssue[] {
  if (result.applicable && result.ran) {
    return result.issues;
  }

  return [];
}

/**
 * Tries to run KoSIT on one XML file.
 *
 * Returns the validation result.
 * If KoSIT found a matching scenario, it also returns the scenario name.
 */
export function runKositAttempt(
  xmlPath: string,
  options: ExternalValidationOptions,
): { result: ApplicableValidatorResult; scenario?: string } {
  // There may or may not be a matching KoSIT scenario.
  let scenario: string | undefined;

  // Try to run KoSIT safely.
  const result = attempt(() => {
    const kositResult = runKositOnFile(xmlPath, options.kosit);

    // Remember the scenario KoSIT matched.
    scenario = kositResult.scenarioName;

    // Convert KoSIT's issues to our standard ComplianceIssue format.
    const issues = kositResult.issues.map((issue) => {
      return fromKositIssue(issue);
    });

    return {
      valid: kositResult.valid,
      issues: issues,
    };
  });

  // If KoSIT did not find a scenario, return only the validation result.
  if (scenario === undefined) {
    return {
      result: result,
    };
  }

  // Otherwise, return both the validation result and scenario.
  return {
    result: result,
    scenario: scenario,
  };
}

/**
 * Returns the KoSIT scenario if one was found.
 * Returns an empty object if there is no scenario.
 */
export function kositScenarioField(
  kosit: { scenario?: string },
): { kositScenario?: string } {
  // KoSIT did not find a matching scenario.
  if (kosit.scenario === undefined) {
    return {};
  }

  // KoSIT found a matching scenario.
  return {
    kositScenario: kosit.scenario,
  };
}

/**
 * Tries to run Mustang on one file.
 *
 * Returns the validation result.
 * If Mustang cannot run, `attempt()` returns `ran: false`.
 */
export function runMustangAttempt(
  path: string,
  options: ExternalValidationOptions,
): ApplicableValidatorResult {
  // This function will run Mustang and prepare its result.
  const runMustangValidator = (): { valid: boolean; issues: ComplianceIssue[] } => { 
    // Mustang accepts a list of files, so put our one file into a list.
    const files = [path];

    // Run Mustang. It returns a list of results.
    const results = runMustang(files, options.mustang);

    // We checked only one file, so get the first result.
    const result = results[0];

    // Something went wrong if Mustang did not return a result.
    if (!result) {
      throw new Error("Mustang returned no result.");
    }

    // Convert Mustang's issues to our standard ComplianceIssue format.
    const issues = result.issues.map((issue) => {
      return fromMustangIssue(issue);
    });

    return {
      valid: result.valid,
      issues: issues,
    };
  };

  // Run Mustang safely. If it throws an error,
  // attempt() returns `ran: false` instead.
  const result = attempt(runMustangValidator);

  return result;
}

/**
 * Checks XML with both KoSIT and Mustang.
 *
 * The XML is saved to a temporary file because KoSIT and Mustang need a file path.
 * Both validators check the same temporary XML file.
 *
 * If one validator cannot run, its result has `ran: false`.
 * The other validator still runs.
 *
 * This only checks the XML with KoSIT and Mustang.
 * It does not run OpenInvoiceXML's own business-rule checks.
 */
export function validateXmlExternally(
  xml: string | Uint8Array,
  options: ExternalValidationOptions = {},
): ExternalValidationResult {
  // This function will run after the temporary XML file is created.
  const validateTemporaryXml = (xmlPath: string): ExternalValidationResult => {
    // Run KoSIT.
    const kosit = runKositAttempt(xmlPath, options);

    // Run Mustang.
    const mustang = runMustangAttempt(xmlPath, options);

    // Get the issues found by each validator.
    const kositIssues = issuesOf(kosit.result);
    const mustangIssues = issuesOf(mustang);

    // Put all issues into one list.
    // KoSIT issues come first, then Mustang issues.
    const complianceIssues = [
      ...kositIssues,
      ...mustangIssues,
    ];

    // Add the KoSIT scenario if KoSIT found one.
    const scenarioField = kositScenarioField(kosit);

    // Build the final result.
    const result: ExternalValidationResult = {
      kosit: kosit.result,
      mustang: mustang,
      ...scenarioField,
      complianceIssues: complianceIssues,
    };

    return result;
  };

  // Save the XML to a temporary file, run both validators,
  // then delete the temporary folder.
  const result = withTempXmlFile(
    xml,
    validateTemporaryXml,
  );

  return result;
}