# Frontend Structure

This document describes the folder convention for `src/frontend/src/`: a numbered-prefix layout, already applied to the current code. The near-term plan is a focused product, not a full multi-tenant SaaS: an XML-in/XML-out invoicing UI (`700-invoicing`) plus the existing beta/developer signup forms. There's no accounts/auth/billing system planned right now, so those speculative slices aren't part of the tree below — the numbering convention still reserves `300`–`600` for them if that ever changes.

## The convention

The numbered top-level folders use a **hybrid structure**:

- `000` through `200` contain shared infrastructure and application-level composition (API client, styles, shared layout chrome, top-level page routing) — these are technical layers, not feature slices.
- `300` and above contain domain-oriented **feature slices**. Within a feature slice, its pages, components, hooks, and API calls stay together instead of being separated globally by file type — e.g. the invoicing feature's components will live in `700-invoicing/components/`, not scattered across a global `200-pages/`. `200-pages` holds only pages that aren't owned by a specific feature (the landing page, legal pages).
- Numbers normally increment in steps of 100, leaving room to insert an additional slice later without renumbering existing folders.
- Lower numbers are more foundational; higher numbers are more feature-specific.
- Planned slices are reserved in this document but don't need to exist as empty directories, and files inside an existing slice aren't created ahead of having real content to put in them (e.g. no `000-core/types.ts` until there's an actual shared type to move there).
- Entrypoint files (`main.tsx` and friends — anything wired up directly in `vite.config.ts` / `index.html`) stay at the `src/` root, not inside a numbered folder.

This is a convention, not a standard architecture — the numbers only buy predictable ordering and reserved room for growth. For a project this size, plain names (`core/`, `features/invoicing/`, ...) would work just as well; numbered slices are used here for 1:1 parity with the backend structure.

## Slice numbers

| #       | Slice        | Meaning                                                                                                                                                                     |
| ------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 000     | `core`       | Shared API client, styles — no feature/page logic                                                                                                                           |
| 100     | `layout`     | Shared chrome: `Header` (site brand link, shown on every page) and `Footer` (wrapper; each page passes its own footer content as children)                                  |
| 200     | `pages`      | Top-level pages not owned by a specific feature                                                                                                                             |
| 300–600 | _(reserved)_ | Not currently planned — available for future domain slices (e.g. authentication, customer accounts, billing) if the product grows beyond invoicing + beta/developer signups |
| 700     | `invoicing`  | UI for the XML invoice engine (planned — next feature)                                                                                                                      |
| 800     | `beta`       | Beta-program signup form for end users — today's actual feature                                                                                                             |
| 900     | `developer`  | Developer feedback form — today's actual feature                                                                                                                            |

`000`/`100`/`200` are frontend-specific infrastructure concepts (there's no backend equivalent of "layout" or "pages"). If a reserved domain slice (e.g. `300-authentication`) is ever built, use the same number on the backend (`docs/BACKENDSTRUCTURE.md`) so the domain stays aligned across stacks.

## Current tree

```
src/frontend/src/
├── main.tsx                     # entrypoints stay at src root, not numbered
├── impressum-main.tsx
├── privacy-main.tsx
├── beta-main.tsx
├── developer-main.tsx
├── 000-core/
│   ├── api.ts                    # shared fetch helper
│   └── style.css
├── 100-layout/
│   ├── Header.tsx                 # site brand link, rendered above <main> on every page
│   └── Footer.tsx                 # shared wrapper; each page passes its own footer content as children
├── 200-pages/
│   ├── App.tsx                   # landing page
│   ├── Impressum.tsx
│   └── Privacy.tsx
├── 700-invoicing/                 # planned — next feature, not built yet
│   ├── components/
│   │   ├── InvoiceForm.tsx
│   │   ├── XmlUpload.tsx
│   │   └── DownloadResult.tsx
│   └── api.ts
├── 800-beta/
│   ├── BetaPage.tsx               # standalone page, served at beta.html
│   ├── BetaForm.tsx
│   └── StatusList.tsx
└── 900-developer/
    ├── DeveloperPage.tsx          # standalone page, served at developer.html
    └── DeveloperForm.tsx
```

`700-invoicing` is still aspirational — the files under it don't exist yet and are shown here as the planned shape once that feature starts. Everything else in this tree matches the actual code. Five HTML entry points now exist (`index.html`, `privacy.html`, `impressum.html`, `beta.html`, `developer.html`), each wired to its own `*-main.tsx` in `vite.config.ts`'s `build.rollupOptions.input` — still no client-side router needed since each page is a fully separate static entry.
