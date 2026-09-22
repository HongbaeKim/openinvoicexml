import { defineConfig, defaultExclude } from "vitest/config";

export default defineConfig({
  test: {
    // Vitest 4 no longer excludes "**/dist/**" by default. 
    // Without this, files created by `npm run build` could be detected again as 
    // test files, causing the same tests to run twice.
    exclude: [...defaultExclude, "**/dist/**"],

    // Vitest defaults maxWorkers to the CPU count, so on a 4-core/4GB box it can run 4 test
    // files at once. Several of those files (90.kosit/91.vera-pdf/92.mustang) shell out to a
    // JVM that defaults its own max heap to 1/4 of physical RAM (~1GB here) with no cap, and
    // the adapter tests instrument PDF generation under coverage — running enough of those
    // concurrently exhausts the box's memory. Capping workers keeps at most a couple of these
    // heavy suites in flight together; see the matching JVM `-Xmx`/JAVA_TOOL_OPTIONS caps in
    // validators/engines/{90.kosit,91.vera-pdf,92.mustang}.ts for the other half of the fix.
    maxWorkers: 2,
    coverage: {
      provider: "v8",

      // Only measure the source code that is shipped as part of the library. 
      // fixtures/ contains test data and scripts/ contains development tooling, 
      // so they should not affect the coverage percentage.
      include: ["core/**/*.ts", "adapters/**/*.ts", "validators/**/*.ts"],
      exclude: ["**/*.test.ts", "**/test/**", "**/dist/**"],

      // Still print the coverage table when a test fails. 
      // This helps us see whether coverage changed during a flaky or failed run.
      reportOnFailure: true,

      // Minimum coverage required for `vitest run --coverage` to pass. 
      //
      // statements: at least 95% of executable statements must run in tests. 
      // branches: at least 83% of decision paths such as if/else conditions 
      // must be tested. 
      // functions: at least 98% of functions must be called by tests. 
      // lines: at least 95% of source lines must be executed by tests. 
      //
      // These limits are slightly below the measured coverage on 2026-09-21: 
      // statements 96.63%, branches 85.05%, functions 99.38%, lines 97.03%. 
      // This gives a small safety margin, but if future changes reduce coverage 
      // below these limits, the coverage command fails so we notice the regression.
      thresholds: {
        statements: 95,
        branches: 83,
        functions: 98,
        lines: 95,
      },
    },
  },
});
