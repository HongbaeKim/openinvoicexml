import { defineConfig, defaultExclude } from "vitest/config";

export default defineConfig({
  test: {
    // vitest 4 dropped "**/dist/**" from its default excludes (vitest 3 had it),
    // so a local `npm run build` output would otherwise get picked up and re-run
    // as duplicate test files alongside their TypeScript sources.
    exclude: [...defaultExclude, "**/dist/**"],
  },
});
