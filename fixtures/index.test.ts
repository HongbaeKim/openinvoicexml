import { readdirSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { allFixtures } from "./index.js";

/**
* `allFixtures` in `fixtures/index.ts` is a manual list of fixture files.
*
* We do this on purpose instead of automatically reading every JSON file from the
* `fixtures/` folder, because static imports let TypeScript/AJV check each fixture
* against the `Invoice` type.
*
* The risk is that someone could add a new fixture file but forget to add it to
* `allFixtures`. Then all tests that use `allFixtures` would silently skip that file.
*
* This test prevents that. It compares the fixture names in `allFixtures` with the
* actual fixture files on disk and fails if they do not match.
*/

describe("allFixtures", () => {
  it("has exactly one entry per *.invoice.json fixture on disk, in sync by number and name", () => {
    const onDiskKeys = readdirSync(new URL(".", import.meta.url))
      .filter((name) => name.endsWith(".invoice.json"))
      .map((name) => name.replace(/\.invoice\.json$/, ""))
      .sort();

    const wiredKeys = allFixtures
      .map(([label]) => {
        const match = /^(\d+)\.\s*([a-z0-9-]+)\s*\(/.exec(label);
        if (!match) throw new Error(`allFixtures label doesn't match the expected shape: ${label}`);
        const [, number, slug] = match;
        return `${number!.padStart(2, "0")}.${slug}`;
      })
      .sort();

    expect(wiredKeys).toEqual(onDiskKeys);
  });
});