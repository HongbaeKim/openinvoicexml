import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
// Gets the operating system's temporary directory.
import { tmpdir } from "node:os";
// Join files paths
import { join } from "node:path";
// describe() → groups related tests together.
// it() → runs one test.
// expect() → checks if the result is correct.
// beforeAll() → runs once before any test, so the shared JVM run only happens once.
// afterAll() → runs once after all tests are finished to clean up.
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { runKosit } from "../90.kosit.js";
import type { KositResult } from "../90.kosit.js";
import { toXRechnung } from "../../adapters/xrechnung.js";
import { toCii } from "../../adapters/cii.js";
import type { Invoice } from "../../core/index.js";

import { allFixtures } from "../../fixtures/index.js";

const JAVA_BIN = existsSync("tools/jre/bin/java") ? "tools/jre/bin/java" : "java";
const JAR_PATH = "tools/kosit/validator.jar";
const SCENARIOS_PATH = "tools/kosit/config/scenarios.xml";

function kositAvailable(): boolean {
  if (!existsSync(JAR_PATH) || !existsSync(SCENARIOS_PATH)) return false;
  try {
    // This executes
    // java -version
    //or tools/jre/bin/java -version
    execFileSync(JAVA_BIN, ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const available = kositAvailable();
// mkdtempSync() appends exactly 6 random characters
const workDir = mkdtempSync(join(tmpdir(), "kosit-test-"));

afterAll(() => {
  // recursive: true: Delete everything inside
  // force: true: Do not throw an error if it is already gone
  rmSync(workDir, { recursive: true, force: true });
});

const BROKEN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice
  xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
</ubl:Invoice>`;

// example) 1. domestic-simple (19% S) -> domestic-simple
function slugify(label: string): string {
  return label.replace(/^\d+\.\s*/, "").replace(/\s*\(.*\)$/, "");
}

/**
 * What's tested here (real KoSIT validator — XSD + Schematron, via the Java jar):
 *
 * - One test per current fixture (all 30 in `fixtures` above): generates XML via
 *   toXRechnung() and confirms KoSIT reports zero error-severity findings — the strongest
 *   check available, since it's the same validator XRechnung recipients actually run.
 * - One negative control ("rejects an invoice missing mandatory fields"): a deliberately
 *   incomplete document is confirmed to fail, proving this harness actually catches errors
 *   rather than rubber-stamping anything handed to it.
 *
 * KoSIT spawns a JVM synchronously per call — startup + schema loading alone takes ~9-10s —
 * so instead of one runKosit() call per test (31 JVM cold-starts), every fixture's XML (plus
 * the broken one) is generated and validated together in ONE runKosit() call inside beforeAll,
 * and the per-fixture it()s just look up their own pre-computed result. Same pattern as
 * `91.vera-pdf.test.ts`'s batched runVeraPdf() call.
 *
 * Skipped entirely (not failed) when Java or the KoSIT jar aren't available locally — see
 * `kositAvailable()` above.
 */
// if Java isn't installed, tests are skipped instead of failing.
describe.skipIf(!available)("runKosit", () => {
  let resultsByPath: Map<string, KositResult>;
  let brokenPath: string;

  beforeAll(() => {
    const allPaths: string[] = [];
    for (const [label, fixture] of allFixtures) {
      // toXRechnung(invoice: Invoice)
      // This function only accepts data shaped like Invoice.
      // so we added as unknown and say Typescript, stop checking
      // as unknown as Invoice: this JSON really matches Invoice"
      const xml = toXRechnung(fixture as Invoice);
      const xmlPath = join(workDir, `${slugify(label)}.xml`);
      // Writes the XML to disk because KoSIT validates files, not strings.
      writeFileSync(xmlPath, xml);
      allPaths.push(xmlPath);
    }

    // it intentionally creates bad XML, validated in the same batch
    brokenPath = join(workDir, "broken.xml");
    writeFileSync(brokenPath, BROKEN_XML);
    allPaths.push(brokenPath);

    const results = runKosit(allPaths, { jarPath: JAR_PATH, scenariosPath: SCENARIOS_PATH });
    // Keyed by the exact XML path each result came from, not the label — avoids any
    // accidental collision if labels ever change or repeat.
    resultsByPath = new Map(results.map((result) => [result.file, result]));
  }, 120000);

  describe.each(allFixtures)("%s", (label) => {
    it("passes KoSIT validation with zero errors", () => {
      const xmlPath = join(workDir, `${slugify(label)}.xml`);
      const result = resultsByPath.get(xmlPath);
      if (!result) throw new Error(`No KoSIT result found for fixture: ${label}`);

      expect(result.valid).toBe(true);
      // keep only issues where the severity is "error"
      // Check that the filtered array has 0 items. (There are no errors)
      expect(result.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
    });
  });

  it("rejects an invoice missing mandatory fields", () => {
    const result = resultsByPath.get(brokenPath);
    if (!result) throw new Error("No KoSIT result found for the broken fixture");

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.severity === "error")).toBe(true);
  });
});

const CII_PROFILES = [
  ["EN16931", "EN16931 (CII)"],
  ["XRECHNUNG", "EN16931 XRechnung (CII)"],
] as const;

/**
 * Same real KoSIT validator, now against toCii()'s CII output — confirms both profile branches
 * land on KoSIT's two real, distinct CII scenarios (`EN16931 (CII)` / `EN16931 XRechnung (CII)`,
 * see tools/kosit/config/scenarios.xml), not just "some scenario accepted it": a document that
 * matched the wrong scenario would still likely report zero errors while silently proving the
 * wrong thing, so this also asserts on the scenario name each file's report actually recorded.
 *
 * 30 fixtures x 2 profiles = 60 documents. As in the UBL suite above, all of them are generated
 * and validated together in ONE runKosit() call inside beforeAll rather than one JVM cold-start
 * per test.
 *
 * Skipped entirely (not failed) under the same `kositAvailable()` condition as the UBL suite
 * above.
 */
describe.skipIf(!available)("runKosit (CII, toCii())", () => {
  const outDir = mkdtempSync(join(tmpdir(), "kosit-cii-test-"));
  afterAll(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  let resultsByKey: Map<string, { 
    result: KositResult; 
    scenarioName: string | undefined 
  }>;

  beforeAll(() => {
    const allPaths: string[] = [];
    const pathByKey = new Map<string, string>();
    for (const [label, fixture] of allFixtures) {
      const slug = slugify(label);
      for (const [profile] of CII_PROFILES) {
        const xml = toCii(fixture as Invoice, { profile });
        const xmlPath = join(workDir, `${slug}-${profile}.xml`);
        writeFileSync(xmlPath, xml);
        allPaths.push(xmlPath);
        pathByKey.set(`${slug}:${profile}`, xmlPath);
      }
    }

    // validate all the file here
    // example of array of KoSIT results
    // batch = [
    //   {
    //     file: "/tmp/a.xml",
    //     valid: true,
    //     issues: [],
    //   },
    //   {
    //     file: "/tmp/b.xml",
    //     valid: false,
    //     issues: [{ severity: "error" }],
    //   },
    // ];
    const batch = runKosit(allPaths, {
      jarPath: JAR_PATH,
      scenariosPath: SCENARIOS_PATH,
      outDir,
    });
    // Turn the batch array into a Map.
    //
    // Before:
    // [
    //   [
    //     "/tmp/a.xml",
    //     { file: "/tmp/a.xml", valid: true }
    //   ],
    //   [
    //     "/tmp/b.xml",
    //     { file: "/tmp/b.xml", valid: false }
    //   ]
    // ]
    //
    // After:
    //
    // byPath = Map {
    //   "/tmp/a.xml" => { file: "/tmp/a.xml", valid: true },
    //   "/tmp/b.xml" => { file: "/tmp/b.xml", valid: false },
    // }
    //
    // Now we can quickly find a KoSIT result using its file path.
    const byPath = new Map(batch.map((result) => [result.file, result]));

    resultsByKey = new Map(
      // pathByKey may contain:
      //
      // "domestic-simple:EN16931"
      //   => "/tmp/domestic-simple-EN16931.xml"
      //
      // "domestic-simple:XRECHNUNG"
      //   => "/tmp/domestic-simple-XRECHNUNG.xml"
      [...pathByKey.entries()].map(([key, xmlPath]) => {
        // Example:
        //
        // key =
        // "domestic-simple:EN16931"
        //
        // xmlPath =
        // "/tmp/domestic-simple-EN16931.xml"

        // Use the XML path to get KoSIT's result.
        //
        // Example:
        // result = {
        //   file: "/tmp/domestic-simple-EN16931.xml",
        //   valid: true,
        //   issues: [],
        // }
        const result = byPath.get(xmlPath);
        if (!result) throw new Error(`No KoSIT result found for CII fixture: ${key}`);
        // Change:
        // "domestic-simple:EN16931"
        //
        // into:
        // "domestic-simple-EN16931-report.xml"
        const reportName = `${key.replace(":", "-")}-report.xml`;
        // Read the KoSIT report file as text.
        //
        // Example:
        // report =
        // "<rep:scenarioMatched>...</rep:scenarioMatched>"
        const report = readFileSync(join(outDir, reportName), "utf8");
        // Find the scenario name inside the report.
        //
        // Example:
        // matched?.[1] =
        // "EN16931 (CII)"
        const matched = /<rep:scenarioMatched><s:scenario><s:name>([^<]*)<\/s:name>/.exec(report);
        // Final value stored in resultsByKey:
        //
        // "domestic-simple:EN16931"
        //   => {
        //        result: { valid: true, ... },
        //        scenarioName: "EN16931 (CII)"
        //      }
        return [key, { result, scenarioName: matched?.[1] }];
      }),
    );
  }, 180000);

  describe.each(allFixtures)("%s", (label) => {
    const slug = slugify(label);

    it.each(CII_PROFILES)(
      "profile %s passes KoSIT and matches the %s scenario",
      (profile, scenarioName) => {
        const entry = resultsByKey.get(`${slug}:${profile}`);
        if (!entry) throw new Error(`No KoSIT result found for CII fixture: ${slug}:${profile}`);

        expect(entry.result.valid).toBe(true);
        expect(entry.result.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
        // Checked independently of `valid`: a document accepted under the *wrong* KoSIT
        // scenario would still likely report zero errors while silently proving the wrong thing.
        expect(entry.scenarioName).toBe(scenarioName);
      },
    );
  });
});
