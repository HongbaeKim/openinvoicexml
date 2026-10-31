import { describe, expect, it } from "vitest";

import {
  requireValidators,
  strictValidation,
  STRICT_VALIDATION_ENV_VAR,
  type ValidatorName,
} from "./validator-availability.test-helpers.js";

const nothingAvailable = (): boolean => false;
const everythingAvailable = (): boolean => true;
const onlyJava = (name: ValidatorName): boolean => name === "Mustang";

describe("strictValidation", () => {
  it("is off without CI or the dedicated variable", () => {
    expect(strictValidation({})).toBe(false);
  });

  it("is on when CI is set, as GitHub Actions does", () => {
    expect(strictValidation({ CI: "true" })).toBe(true);
  });

  it("is on when the dedicated variable is set, outside GitHub Actions", () => {
    expect(strictValidation({ [STRICT_VALIDATION_ENV_VAR]: "1" })).toBe(true);
  });

  it.each(["", "0", "false", "FALSE"])("treats %j as off", (value) => {
    expect(strictValidation({ CI: value })).toBe(false);
    expect(strictValidation({ [STRICT_VALIDATION_ENV_VAR]: value })).toBe(false);
  });
});

describe("requireValidators", () => {
  it("returns true when every named validator is available, strict or not", () => {
    expect(requireValidators(["KoSIT", "Mustang"], {}, everythingAvailable)).toBe(true);
    expect(requireValidators(["KoSIT", "Mustang"], { CI: "true" }, everythingAvailable)).toBe(true);
  });

  it("returns false (the suite skips) when a validator is missing and strict mode is off", () => {
    expect(requireValidators(["KoSIT"], {}, nothingAvailable)).toBe(false);
  });

  it("throws in CI, naming the validator and its setup script", () => {
    expect(() => requireValidators(["KoSIT"], { CI: "true" }, nothingAvailable)).toThrow(
      "KoSIT must be available in CI (run scripts/setup-kosit.sh)",
    );
  });

  it("throws with the dedicated variable alone", () => {
    expect(() =>
      requireValidators(["veraPDF"], { [STRICT_VALIDATION_ENV_VAR]: "1" }, nothingAvailable),
    ).toThrow("veraPDF must be available in CI (run scripts/setup-verapdf.sh)");
  });

  it("names every missing validator, and only the missing ones", () => {
    let message = "";
    try {
      requireValidators(["KoSIT", "Mustang", "veraPDF"], { CI: "true" }, onlyJava);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("scripts/setup-kosit.sh");
    expect(message).toContain("scripts/setup-verapdf.sh");
    expect(message).not.toContain("scripts/setup-mustang.sh");
  });
});
