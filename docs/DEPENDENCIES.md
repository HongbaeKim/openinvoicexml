# Dependencies

`package.json` is plain JSON and cannot hold inline comments, so the purpose of each
dependency is documented here instead.

This project has no runtime (`dependencies`) — only `devDependencies`, used for
building, type-checking, linting, formatting, and testing.

## devDependencies

| Package | Purpose |
|---|---|
| `@types/node` | Type definitions for Node.js built-in modules (used by build scripts and tests). |
| `@typescript-eslint/eslint-plugin` | ESLint rules for TypeScript-specific issues (unused vars, type safety, etc.). |
| `@typescript-eslint/parser` | Lets ESLint parse TypeScript syntax. |
| `@vitest/coverage-v8` | Code coverage reporting for `vitest` via V8's built-in coverage. |
| `ajv` | JSON Schema validator (Draft-07/2020-12) used to validate invoice JSON against `schemas/invoice.schema.json`. |
| `ajv-formats` | Adds format validators (`date`, `email`, etc.) to `ajv`, used by the schema's `format` keywords. |
| `eslint` | Linter for catching code issues and enforcing style rules. |
| `eslint-config-prettier` | Disables ESLint formatting rules that conflict with Prettier. |
| `prettier` | Code formatter for consistent style across the codebase. |
| `typescript` | TypeScript compiler, used for type-checking and building `dist/`. |
| `vitest` | Test runner used for unit and schema validation tests. |
