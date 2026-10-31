// The one place that decides whether an external validator (KoSIT, Mustang, veraPDF) is usable
// in a test run, and what happens when it is not. Not a test file itself (vitest doesn't collect
// *.test-helpers.ts), and dropped from the npm package by "!dist/**/*.test-helpers.*".
//
// Locally a missing validator means its suite is skipped, so contributors without Java can still
// run `npm test`. In strict mode a missing validator throws, so a green run proves the external
// validation actually ran instead of being skipped.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export type ValidatorName = "KoSIT" | "Mustang" | "veraPDF";

/** Strict mode is on when CI is set (GitHub Actions sets CI=true) or this variable is. */
export const STRICT_VALIDATION_ENV_VAR = "OPENINVOICE_STRICT_VALIDATION";

const SETUP_SCRIPT: Record<ValidatorName, string> = {
  KoSIT: "scripts/setup-kosit.sh",
  Mustang: "scripts/setup-mustang.sh",
  veraPDF: "scripts/setup-verapdf.sh",
};

const JAVA_BIN = existsSync("tools/jre/bin/java") ? "tools/jre/bin/java" : "java";

function isSet(value: string | undefined): boolean {
  return value !== undefined && value !== "" && value !== "0" && value.toLowerCase() !== "false";
}

export function strictValidation(env: NodeJS.ProcessEnv = process.env): boolean {
  return isSet(env.CI) || isSet(env[STRICT_VALIDATION_ENV_VAR]);
}

function javaRuns(): boolean {
  try {
    execFileSync(JAVA_BIN, ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Is the tool available? */
export function probeValidator(name: ValidatorName): boolean {
  switch (name) {
    case "KoSIT":
      return (
        existsSync("tools/kosit/validator.jar") &&
        existsSync("tools/kosit/config/scenarios.xml") &&
        javaRuns()
      );
    case "Mustang":
      return existsSync("tools/mustang/mustang-cli.jar") && javaRuns();
    case "veraPDF": {
      const cli = "tools/verapdf/verapdf";
      if (!existsSync(cli)) return false;
      try {
        const env = { ...process.env };
        const jreHome = resolve("tools/jre");
        if (existsSync(`${jreHome}/bin/java`)) env.JAVA_HOME = jreHome;
        execFileSync(cli, ["--version"], { stdio: "ignore", env });
        return true;
      } catch {
        return false;
      }
    }
  }
}

/**
 * What should we do if the tool is missing?
 * 
 * Checks whether all required validators (KoSIT, Mustang, veraPDF) are available.
 *
 * - All available: returns true, so tests can run.
 * - Missing in normal mode: returns false, so tests can be skipped.
 * - Missing in strict mode (CI): throws an error explaining which
 *   validators are missing and how to install them.
 *
 * The optional parameters make this function easier to test:
 * - env: Uses process.env by default. Tests can provide a fake
 *   environment, such as { CI: "true" }.
 * - probe: Checks real installed validators by default. Tests can
 *   simulate missing validators without uninstalling anything.
 *
 * In normal use, simply call requireValidators(["KoSIT"]).
 * Call it when defining the test suite so strict-mode errors
 * are reported instead of silently skipping tests.
 */
export function requireValidators(
  names: ValidatorName[],
  env: NodeJS.ProcessEnv = process.env,
  probe: (name: ValidatorName) => boolean = probeValidator,
): boolean {
  const missing = names.filter((name) => !probe(name));
  if (missing.length === 0) return true;
  if (strictValidation(env)) {
    throw new Error(
      missing
        .map((name) => `${name} must be available in CI (run ${SETUP_SCRIPT[name]})`)
        .join("; ") + ` (strict validation: CI or ${STRICT_VALIDATION_ENV_VAR} is set)`,
    );
  }
  return false;
}
