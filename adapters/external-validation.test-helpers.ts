// Shared by the external-validation*.test.ts files. Not a test file itself (vitest doesn't
// collect *.test-helpers.ts), and dropped from the npm package by "!dist/**/*.test-helpers.*".

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";

import type { ExternalValidatorResult } from "./external-validation.js";
import type { FileValidationOptions } from "./external-validation-file.js";
import { toXRechnung } from "./xrechnung.js";
import { toCii } from "./cii.js";
import type { Invoice } from "../core/index.js";

import { domesticSimple } from "../fixtures/index.js";

const JAVA_BIN = existsSync("tools/jre/bin/java") ? "tools/jre/bin/java" : "java";

function javaAvailable(): boolean {
  try {
    execFileSync(JAVA_BIN, ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Real KoSIT + Mustang runs need both jars and Java; skipped, not failed, without them. */
export function validatorsAvailable(): boolean {
  const kosit =
    existsSync("tools/kosit/validator.jar") && existsSync("tools/kosit/config/scenarios.xml");
  return kosit && existsSync("tools/mustang/mustang-cli.jar") && javaAvailable();
}

/** Real file validation also needs veraPDF (for PDFs). */
export function allValidatorsAvailable(): boolean {
  return validatorsAvailable() && existsSync("tools/verapdf/verapdf");
}

/** Temp dirs with this prefix left behind in the OS temp dir. */
export function leftoverTempDirs(prefix: string): string[] {
  return readdirSync(tmpdir())
    .filter((name) => name.startsWith(prefix))
    .sort();
}

/** Points every validator at a missing jar/CLI, so none of them can start a JVM. */
export const NO_VALIDATORS: FileValidationOptions = {
  kosit: { jarPath: "does-not-exist/validator.jar" },
  mustang: { jarPath: "does-not-exist/mustang-cli.jar" },
  veraPdf: { cliPath: "does-not-exist/verapdf" },
};

export const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

export const BROKEN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice
  xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
</ubl:Invoice>`;

export const ublXml = toXRechnung(domesticSimple as Invoice);
export const ciiXml = toCii(domesticSimple as Invoice, { profile: "XRECHNUNG" });

/** Narrows a validator result to "ran", failing the test with the actual result otherwise. */
export function ran(
  result: ExternalValidatorResult,
): Extract<ExternalValidatorResult, { ran: true }> {
  if (!result.applicable || !result.ran) {
    throw new Error(`expected the validator to have run, got ${JSON.stringify(result)}`);
  }
  return result;
}
