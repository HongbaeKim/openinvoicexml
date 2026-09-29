import { existsSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { describe, it, expect } from "vitest";
import { validateXmlExternally, withTempXmlFile } from "./external-validation.js";
import { NO_VALIDATORS, leftoverTempDirs } from "./external-validation.test-helpers.js";

describe("withTempXmlFile", () => {
  it("writes Uint8Array bytes unchanged", () => {
    // BOM + invalid UTF-8 byte. Re-encoding these bytes would change them.
    // 0xef 0xbb 0xbf  → UTF-8 BOM
    // 0x3c            → <
    // 0x61            → a
    // 0x2f            → /
    // 0x3e            → >
    // 0xff            → intentionally invalid UTF-8 byte
    const input = new Uint8Array([
      0xef, 0xbb, 0xbf,
      0x3c, 0x61, 0x2f, 0x3e,
      0xff,
    ]);

    const written = withTempXmlFile(input, (path) => readFileSync(path));

    expect(new Uint8Array(written)).toEqual(input);
  });

  it("writes strings as UTF-8", () => {
    const input = "<a>Müller</a>";
    const expected = Buffer.from(input, "utf8");

    const written = withTempXmlFile(input, (path) => readFileSync(path));

    expect(written.equals(expected)).toBe(true);
  });

  // cleanup when something crashes
  it("cleans up the temp directory when the callback throws", () => {
    const dirsBefore = leftoverTempDirs("external-validation-");
    let tempDir = "";

    expect(() => {
      withTempXmlFile("<a/>", (path) => {
        tempDir = dirname(path);
        throw new Error("validator crashed");
      });
    }).toThrow("validator crashed");
    // The particular temporary directory we used must be gone.
    expect(existsSync(tempDir)).toBe(false);
    // The overall list of temporary directories should be exactly the same as before.
    expect(leftoverTempDirs("external-validation-")).toEqual(dirsBefore);
  });
});

// Now we test the higher-level function
describe("validateXmlExternally", () => {
  it("reports unavailable validators without creating compliance issues", () => {
    const dirsBefore = leftoverTempDirs("external-validation-");
    // check NO_VALIDATORS to see validator unavailable
    const result = validateXmlExternally("<a/>", NO_VALIDATORS);

    expect(result.kosit).toMatchObject({
      applicable: true,
      ran: false,
      valid: false,
    });

    expect(result.mustang).toMatchObject({
      applicable: true,
      ran: false,
      valid: false,
    });

    // Narrow the result types so TypeScript knows `.error` is available.
    if (result.kosit.ran || result.mustang.ran) {
      throw new Error("Expected both validators to be unavailable");
    }

    expect(result.kosit.error).toMatch(/KoSIT/);
    expect(result.mustang.error).toMatch(/Mustang/);
    expect(result.complianceIssues).toEqual([]);

    expect(leftoverTempDirs("external-validation-")).toEqual(dirsBefore);
  });
});