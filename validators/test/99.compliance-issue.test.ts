import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

import {
  SUGGESTED_FIXES,
  fromValidationIssue,
  fromKositIssue,
  fromVeraPdfIssue,
  fromMustangIssue,
} from "../engines/99.compliance-issue.js";
import type { ValidationIssue } from "../types.js";
import type { KositIssue } from "../engines/90.kosit.js";
import type { VeraPdfIssue } from "../engines/91.vera-pdf.js";
import type { MustangIssue } from "../engines/92.mustang.js";

/**
 * What's tested here (Week 16 Task 3 — unified compliance diagnostics):
 *
 * | Describe block            | Checks                                                              |
 * |----------------------------|----------------------------------------------------------------------|
 * | fromValidationIssue        | source is "business-rules"; suggestedFix looked up by code; absent when the code has none |
 * | fromKositIssue              | "[CODE]" prefix extracted as code; falls back to "KOSIT" without one; "information" -> "warning"; location -> path (or "" if absent) |
 * | fromVeraPdfIssue            | "clause:" prefix extracted as code; falls back to "VERA_PDF" without one; location -> path (or "" if absent) |
 * | fromMustangIssue            | ruleTest -> code; falls back to "MUSTANG" without one; "information" -> "warning"; location -> path (or "" if absent) |
 * | SUGGESTED_FIXES completeness | every `code: "..."` literal in validators/02.business-rules.ts and validators/rules/*.ts has a SUGGESTED_FIXES entry |
 */
describe("fromValidationIssue", () => {
  it("tags the issue with source 'business-rules' and looks up a suggested fix by code", () => {
    const issue: ValidationIssue = {
      code: "LINE_AMOUNT_ROUNDING",
      severity: "error",
      message: "lines[0].lineAmount: BT-131 line net amount 10 does not match 20.",
      path: "lines[0].lineAmount",
    };
    const compliance = fromValidationIssue(issue);
    expect(compliance.source).toBe("business-rules");
    expect(compliance.suggestedFix).toBe(SUGGESTED_FIXES.LINE_AMOUNT_ROUNDING);
    expect(compliance.code).toBe(issue.code);
    expect(compliance.severity).toBe(issue.severity);
    expect(compliance.message).toBe(issue.message);
    expect(compliance.path).toBe(issue.path);
  });

  it("leaves suggestedFix undefined for a code with no lookup entry", () => {
    const issue: ValidationIssue = {
      code: "SOME_FUTURE_CODE_NOT_YET_MAPPED",
      severity: "warning",
      message: "a hypothetical future rule",
      path: "somewhere",
    };
    const compliance = fromValidationIssue(issue);
    expect(compliance.source).toBe("business-rules");
    expect(compliance.suggestedFix).toBeUndefined();
  });
});

describe("fromKositIssue", () => {
  it("extracts the bracketed rule id from the message as code", () => {
    const issue: KositIssue = {
      severity: "error",
      message: '[BR-DE-14] Das Element "VAT category rate" (BT-119) muss übermittelt werden.',
      location: "/Invoice/TaxTotal",
    };
    const compliance = fromKositIssue(issue);
    expect(compliance.code).toBe("BR-DE-14");
    expect(compliance.source).toBe("kosit");
    expect(compliance.severity).toBe("error");
    expect(compliance.message).toBe(issue.message);
    expect(compliance.path).toBe("/Invoice/TaxTotal");
    expect(compliance.suggestedFix).toBeUndefined();
  });

  it("falls back to a generic code when the message has no bracketed rule id", () => {
    const issue: KositIssue = {
      severity: "error",
      message: "No KoSIT scenario matched this document.",
    };
    const compliance = fromKositIssue(issue);
    expect(compliance.code).toBe("KOSIT");
    expect(compliance.path).toBe("");
  });

  it("maps 'information' severity down to 'warning'", () => {
    const issue: KositIssue = {
      severity: "information",
      message: "[BR-DE-TMP-32] Eine Rechnung sollte ein Liefer-/Leistungsdatum enthalten.",
    };
    expect(fromKositIssue(issue).severity).toBe("warning");
  });

  it("passes 'warning' severity through unchanged", () => {
    const issue: KositIssue = { severity: "warning", message: "[SOME-RULE] a warning finding" };
    expect(fromKositIssue(issue).severity).toBe("warning");
  });
});

describe("fromVeraPdfIssue", () => {
  it("extracts the PDF/A clause number from the message as code", () => {
    const issue: VeraPdfIssue = {
      severity: "error",
      message: "6.3.4: Font is not embedded",
      location: "pages[0]/fonts[2]",
    };
    const compliance = fromVeraPdfIssue(issue);
    expect(compliance.code).toBe("6.3.4");
    expect(compliance.source).toBe("vera-pdf");
    expect(compliance.severity).toBe("error");
    expect(compliance.path).toBe("pages[0]/fonts[2]");
    expect(compliance.suggestedFix).toBeUndefined();
  });

  it("falls back to a generic code when the message has no clause prefix", () => {
    const issue: VeraPdfIssue = {
      severity: "error",
      message: "veraPDF reported the document as non-compliant.",
    };
    const compliance = fromVeraPdfIssue(issue);
    expect(compliance.code).toBe("VERA_PDF");
    expect(compliance.path).toBe("");
  });
});

describe("fromMustangIssue", () => {
  it("extracts the Schematron rule test from the issue as code", () => {
    const issue: MustangIssue = {
      severity: "error",
      message: "[BR-02]-An Invoice shall have an Invoice number (BT-1).",
      location: "/*:Invoice[1]",
      ruleTest: "normalize-space(cbc:ID) != ''",
    };
    const compliance = fromMustangIssue(issue);
    expect(compliance.code).toBe("normalize-space(cbc:ID) != ''");
    expect(compliance.source).toBe("mustang");
    expect(compliance.severity).toBe("error");
    expect(compliance.message).toBe(issue.message);
    expect(compliance.path).toBe("/*:Invoice[1]");
    expect(compliance.suggestedFix).toBeUndefined();
  });

  it("falls back to a generic code when the issue has no rule test (e.g. a schema validation finding)", () => {
    const issue: MustangIssue = {
      severity: "error",
      message: "schema validation fails: cvc-complex-type.2.4.b: ...",
    };
    const compliance = fromMustangIssue(issue);
    expect(compliance.code).toBe("MUSTANG");
    expect(compliance.path).toBe("");
  });

  it("maps 'information' severity down to 'warning'", () => {
    const issue: MustangIssue = {
      severity: "information",
      message: "a Mustang notice-tier finding",
      ruleTest: "some-rule-test",
    };
    expect(fromMustangIssue(issue).severity).toBe("warning");
  });

  it("passes 'warning' severity through unchanged", () => {
    const issue: MustangIssue = { severity: "warning", message: "a warning finding" };
    expect(fromMustangIssue(issue).severity).toBe("warning");
  });
});

describe("SUGGESTED_FIXES completeness", () => {
  it("has an entry for every ValidationIssue code produced by validators/engines/02.business-rules.ts and validators/rules/*.ts", () => {
    const sourceFiles = [
      "validators/engines/02.business-rules.ts",
      ...readdirSync("validators/rules")
        .filter((f) => f.endsWith(".ts"))
        .map((f) => `validators/rules/${f}`),
    ];

    const codePattern = /code:\s*"([A-Z][A-Z0-9_]*)"/g;
    const codesFound = new Set<string>();
    for (const file of sourceFiles) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(codePattern)) {
        codesFound.add(match[1]!);
      }
    }

    // Sanity check on the extraction itself, not just the lookup below — if this drops to 0,
    // the regex/file list broke, and the completeness check below would trivially "pass" on
    // nothing.
    expect(codesFound.size).toBeGreaterThan(30);

    const missing = [...codesFound].filter((code) => !(code in SUGGESTED_FIXES)).sort();
    expect(missing).toEqual([]);
  });
});
