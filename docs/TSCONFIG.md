# TypeScript Configuration

`tsconfig.json` is plain JSON and cannot hold inline comments, so each
`compilerOptions` entry is documented here instead.

## compilerOptions

| Option | Value | Purpose |
|---|---|---|
| `target` | `ES2022` | Compile output to ES2022 syntax, matching the minimum supported Node.js version (>=20). |
| `module` | `NodeNext` | Use Node's native ESM module system, matching `"type": "module"` in `package.json`. |
| `moduleResolution` | `NodeNext` | Resolve imports the same way Node does for ESM (requires explicit file extensions in relative imports). |
| `lib` | `["ES2022"]` | Include type definitions for ES2022 built-ins only — no DOM types, since this is a Node library. |
| `outDir` | `./dist` | Emit compiled output to `dist/`. |
| `rootDir` | `.` | Treat the project root as the source root, preserving the `core/`, `adapters/`, `validators/` directory structure under `dist/`. |
| `declaration` | `true` | Emit `.d.ts` type declaration files alongside compiled output, so consumers get type information. |
| `declarationMap` | `true` | Emit source maps for `.d.ts` files, so editors can jump from declarations to the original `.ts` source. |
| `sourceMap` | `true` | Emit `.js.map` source maps for debugging compiled output. |
| `strict` | `true` | Enable all strict type-checking options (`strictNullChecks`, `noImplicitAny`, etc.). |
| `noUncheckedIndexedAccess` | `true` | Treat indexed access (e.g. `arr[i]`) as possibly `undefined`, catching out-of-bounds bugs at compile time. |
| `noImplicitOverride` | `true` | Require the `override` keyword when overriding a base class member, preventing accidental signature drift. |
| `exactOptionalPropertyTypes` | `true` | Distinguish between an optional property that is missing and one explicitly set to `undefined`. |
| `forceConsistentCasingInFileNames` | `true` | Reject imports that differ only in filename casing, avoiding cross-platform (Linux/macOS/Windows) build issues. |
| `skipLibCheck` | `true` | Skip type-checking of `.d.ts` files in `node_modules`, speeding up builds and avoiding errors from third-party type bugs. |
| `resolveJsonModule` | `true` | Allow importing `.json` files as typed modules (used to load `schemas/invoice.schema.json` directly). |
| `esModuleInterop` | `true` | Allow default imports from CommonJS modules (e.g. `import Ajv from "ajv"`), needed since `ajv` and `ajv-formats` ship as CJS. |

## include / exclude

| Key | Value | Purpose |
|---|---|---|
| `include` | `["core/**/*", "adapters/**/*", "validators/**/*"]` | Only compile the library source directories. |
| `exclude` | `["node_modules", "dist", "fixtures"]` | Exclude dependencies, build output, and test fixtures from compilation. |
