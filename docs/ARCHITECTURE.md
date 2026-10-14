# Architecture

How `openinvoicexml`'s modules fit together and why.

---

## Design Principle

The project is built around a **single internal schema** that serves as the source of truth for
all invoice data. Every downstream module — validators, XML adapters, PDF adapters — reads only
from this schema. No adapter ever touches raw user input directly. This means input formats can
change without touching output logic, output adapters can be added/removed independently, and
validation runs against one consistent representation.

## Data Flow

```
                          ┌─────────────────┐
                          │   JSON input     │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  JSON Schema     │
                          │  validation      │
                          │  (consumer-side) │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  Internal        │
                          │  Invoice object  │
                          │  (TypeScript)    │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  Business rule   │
                          │  validation      │
                          └────────┬────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
           ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
           │ XRechnung   │ │ CII XML     │ │ Hybrid      │
           │ XML adapter │ │ adapter     │ │ PDF/A-3     │
           │ (UBL)       │ │ (EN16931/   │ │ adapter     │
           │             │ │ XRechnung)  │ │ (2 entry    │
           │             │ │             │ │ points)     │
           └─────────────┘ └─────────────┘ └─────────────┘
```

All three are implemented. The hybrid PDF/A-3 adapter's two entry points (`toHybridPdf()`/
`toFacturXPdf()`) each consume one of the other two adapters' output — see `adapters/` below.
The same flow runs in Node.js and in the browser; see
[Browser and Node.js execution](#browser-and-nodejs-execution).

1. **Input** arrives as JSON matching `schemas/invoice.schema.json`.
2. **Schema validation** (`validateInvoiceSchema()`, run first by `generateInvoice()`) checks
   structural completeness against the schema.
3. The validated object becomes an **internal `Invoice`** — a TypeScript interface with fields
   mapping to XRechnung Business Terms.
4. **Business rule validation** checks legal/arithmetic correctness: VAT category consistency,
   §13b reverse-charge requirements, EN 16931 rounding rules, document-total coherence.
5. **Output adapters** transform the validated invoice into a target format, independently of
   each other.

## Module Map

| Directory     | Purpose                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `core/`       | TypeScript types for the internal invoice model — no dependencies on any other module                                    |
| `schemas/`    | `invoice.schema.json` (JSON Schema, Draft-07) — the language-independent structural contract                             |
| `validators/` | `validateBusinessRules()` + per-scenario `rules/*.ts`, plus `runKosit()`/`runVeraPdf()`/`runMustang()` (Node-only, Java) |
| `adapters/`   | Output adapters — XRechnung UBL XML, CII XML, and two hybrid PDF/A-3 entry points, all implemented                       |
| `fixtures/`   | Example invoice JSON files, one per legal scenario — see [`fixtures/README.md`](../fixtures/README.md) for the full list |
| `docs/`       | Project documentation                                                                                                    |

### `validators/`

Four parts, each catching a different class of error or normalizing the results:

- **Schema validation** (`invoice.schema.json`, `engines/01.schema.ts`) — structural errors:
  missing fields, wrong types, invalid formats. `validateInvoiceSchema()` is run first by
  `generateInvoice()`; it is Node-only, so a browser consumer with untyped JSON input validates
  against the schema themselves before constructing an `Invoice`.
- **Business rule validation** (`validateBusinessRules()`, in `engines/02.business-rules.ts` +
  `rules/*.ts`) — legal errors valid JSON can still contain: VAT rate/category consistency,
  reverse-charge/exemption requirements, line and document total arithmetic. Returns
  `ValidationIssue[]`, never throws.
- **External validators** — wrappers around third-party Java tools, a separate check of the
  generated output: KoSIT (`engines/90.kosit.ts`, XSD/Schematron for XRechnung and EN 16931),
  veraPDF (`engines/91.vera-pdf.ts`, PDF/A conformance), and Mustang
  (`engines/92.mustang.ts`, Factur-X/ZUGFeRD and XRechnung). They start Java child processes,
  so they're Node-only: `openinvoicexml/browser` never reaches them, and they run only through
  `openinvoicexml/adapters`. See [`COMPLIANCE.md`](COMPLIANCE.md#validating-this-projects-output).
- **Unified diagnostics** (`engines/99.compliance-issue.ts`) — normalizes `ValidationIssue`/`KositIssue`/
  `VeraPdfIssue` into one `ComplianceIssue` shape (`source`, optional `suggestedFix`), consumed by
  `generateInvoice(invoice, { validateExternally: true })`. See
  [`API.md`](API.md#unified-compliance-diagnostics-complianceissue).

### `adapters/`

Each adapter follows the same isolation convention: its own `*-mapping.ts` for BT-to-field
resolution and its own serializer for the output format, deliberately **not** sharing a generic
mapping module across adapters even when the resolved field shapes look similar — confirmed
independently for `cii-mapping.ts` vs. `xrechnung-mapping.ts` and for
`hybrid-pdf-mapping.ts`.

- **XRechnung XML adapter** — implemented: UBL 2.1 XML targeting XRechnung 3.x.
  `xrechnung-mapping.ts` handles BT-to-field resolution, `xrechnung.ts` handles serialization,
  and `generate-invoice.ts` composes `validateBusinessRules()` with `toXRechnung()` behind the
  `generateInvoice()` entry point (see [`API.md`](API.md)).
- **Browser entry** — `browser.ts`, exported as `openinvoicexml/browser`: `generateInvoiceXml()`
  (the validate-then-convert step), `toXRechnung()`, `toCii()`/`generateCii()` (optional CII
  XML; `generateCii()` has the business-rule gate only, no schema step),
  `validateBusinessRules()`, and the PDF
  functions `toHybridPdf()`/`toFacturXPdf()` from `browser-pdf.ts`. Its import graph never
  reaches Node-only code (enforced by `browser.test.ts`). The dependency is one-way:
  `generate-invoice.ts` imports `browser.ts` and adds the Node-only KoSIT step on top, and
  `browser.ts` never imports anything Node-side. See
  [Browser and Node.js execution](#browser-and-nodejs-execution).
- **External validation** — Node-only, kept separate from generation (Invoice → XML), in three
  files:
  - `external-validation.ts`: XML → KoSIT/Mustang result (`validateXmlExternally()`), plus the
    temp-file handling and validator runners the other two reuse. `generate-invoice.ts` reuses
    its KoSIT-only helper for `{ validateExternally: true }`.
  - `external-validation-detect.ts`: the content-only format detector `detectInvoiceFormat()`.
  - `external-validation-file.ts`: an existing XML/PDF file → KoSIT/Mustang/veraPDF report
    (`validateFileExternally()`).
- **CII XML adapter** — implemented: UN/CEFACT Cross Industry Invoice XML, profile-aware
  (`EN16931`/`XRECHNUNG`, selecting which `GuidelineSpecifiedDocumentContextParameter` URN gets
  written). `cii-mapping.ts` + `cii.ts` mirror the XRechnung adapter's own split. Required because
  every Factur-X/ZUGFeRD conformance level needs CII, not UBL — `toXRechnung()` can't serve that
  role. See [`API.md`](API.md).
- **Hybrid PDF/A-3 adapter** — implemented, split across three files so the Node and browser entry
  points share one implementation:
  - `hybrid-pdf-core.ts`: browser-safe layout and embedding (`buildHybridPdf()`/
    `buildFacturXPdf()`). Takes font bytes as input and imports no Node modules.
    `toHybridPdf()`'s path embeds the UBL XML as a plain associated file (no Factur-X/ZUGFeRD
    claim); `toFacturXPdf()`'s path embeds the CII XML via `@cantoo/pdf-lib`'s `embedFacturX()`
    (`fx:` XMP metadata, a genuine conformance claim).
  - `hybrid-pdf.ts`: the Node entry points. Reads the bundled fonts from disk and adds
    `extractEmbeddedXml()`.
  - `browser-pdf.ts`: the browser entry points. Fetches the bundled fonts, or accepts them via
    the `fonts` option.

  `hybrid-pdf-mapping.ts` resolves BT-to-field values for the layout.
  `generate-invoice.ts` composes `validateBusinessRules()` with each Node entry point behind
  `generateHybridPdf()`/`generateFacturXPdf()`. See [`API.md`](API.md).

- **Profile support** — `EInvoiceProfile` is `"XRECHNUNG" | "EN16931"`. The UBL and CII adapters
  both consume the same `Invoice` model; `toXRechnung()` always targets XRechnung, while
  `toCii()`/`toFacturXPdf()` take a `profile`. Factur-X MINIMUM, BASIC WL, and BASIC are not
  supported; see [`LIMITATIONS.md`](LIMITATIONS.md) and
  [`SUPPORTED_SCENARIOS.md`](SUPPORTED_SCENARIOS.md).

---

## Key Decisions

- **JSON Schema, not TypeScript-only validation** — language-independent, so it can be consumed
  by non-TypeScript tooling and collaborators.
- **Minimal, justified runtime dependencies** — see below.
- **Validation returns data, not exceptions** — `validateBusinessRules()` returns
  `ValidationIssue[]` so callers can see every issue at once instead of catch-fix-retry.
- **`generateInvoice()` gates output on business-rule errors** — see [`API.md`](API.md) for the
  full contract.
- **Adapter pattern for output formats** — each format is an independent module whose mapping
  depends only on `core/` types, so XML and PDF generation/validation stay decoupled. UBL and CII
  adapters share the `Invoice` model, not each other's code. Factur-X profile support is
  described in `adapters/` above.
- **One shared, browser-safe core for generation** — layout and serialization carry no Node
  imports; only fonts-from-disk and external validators are Node-specific.

### Runtime dependencies

Dependencies are minimal and each is a deliberate, justified exception; the current list and
rationale are in [`DEVELOPMENT.md`](DEVELOPMENT.md#dependency-policy).

- **PDF generation** — [`@cantoo/pdf-lib`](https://github.com/cantoo-scribe/pdf-lib) and
  [`fontkit`](https://github.com/foliojs/fontkit), used by the hybrid PDF/A-3 adapter
  (`hybrid-pdf-core.ts`). PDF/A-3 conformance — font subsetting, ICC output intents,
  embedded-file attachments with `AFRelationship`, XMP metadata — isn't something that can
  reasonably be hand-rolled the way XRechnung's XML serialization was. Both are browser-safe, so
  they are also used by `openinvoicexml/browser`'s PDF functions.
- **Schema validation** — [`ajv`](https://ajv.js.org) and `ajv-formats` back
  `validators/engines/01.schema.ts` (`validateInvoiceSchema()`), which `generateInvoice()` runs
  on every call so malformed input returns structured issues instead of throwing. Node-only,
  and deliberately kept out of the browser entry.
- **Development only** — `vitest`, `eslint`, `prettier`, and `typescript` are devDependencies
  used only for this repo's own build/test/lint.

**Why:** minimizing dependencies keeps the library easy to embed, audit, and trust — invoice
processing is a sensitive domain, and every dependency is a supply-chain risk — so each one
added should be a deliberate, justified exception rather than a default. XML serialization
(UBL and CII) remains dependency-free.

---

## Browser and Node.js execution

The invoice engine runs in two environments. Generation is shared; only validation and
file-system access differ.

```
┌──────────────────────────────────────────────────────────────┐
│ Shared, browser-compatible engine                            │
│ Invoice model (core/), business rules (validators/rules,     │
│ engines/02), UBL/CII serialization, PDF layout and embedding │
│ (hybrid-pdf-core.ts) — no Node-only dependencies             │
└───────────────┬──────────────────────────────┬───────────────┘
                │                              │
                ▼                              ▼
┌───────────────────────────────┐ ┌────────────────────────────────┐
│ Browser                       │ │ Node.js                        │
│ openinvoicexml/browser        │ │ openinvoicexml/adapters        │
│ XML: generateInvoiceXml(),    │ │ Generation: generateInvoice(), │
│      toCii()                  │ │ toCii(), toHybridPdf(),        │
│ PDF: toHybridPdf(),           │ │                                │
│      toFacturXPdf()           │ │ toFacturXPdf(), …              │
│ Fonts fetched (browser-pdf.ts)│ │ Fonts read from disk           │
│                               │ │ External validation (Java):    │
│                               │ │ KoSIT, Mustang, veraPDF        │
└───────────────────────────────┘ └────────────────────────────────┘
```

| Capability                                  | Browser (`openinvoicexml/browser`) | Node.js (`openinvoicexml/adapters`) |
| ------------------------------------------- | ---------------------------------- | ----------------------------------- |
| Business-rule validation                    | Yes                                | Yes                                 |
| JSON Schema validation                      | No                                 | Yes (`generateInvoice()`)           |
| XRechnung UBL XML                           | Yes                                | Yes                                 |
| Standalone CII XML                          | Yes (`toCii()`, `generateCii()`)   | Yes (`toCii()`, `generateCii()`)    |
| Hybrid PDF and Factur-X PDF                 | Yes                                | Yes                                 |
| External validation (KoSIT/Mustang/veraPDF) | No (requires Java)                 | Yes                                 |

The browser entry's import graph is checked by `adapters/browser.test.ts`, so Node-only code
can't leak into it. Browser-generated output is the same as Node's, as the PDF layout and XML
serializers are shared. Validating the exact generated XML requires a Node backend; see
[`COMPLIANCE.md`](COMPLIANCE.md#browser-generated-xml-openinvoicexmlbrowser).

---

## Website and hosted backend

The website, beta/developer signup backend, and deploy tooling that used to live under `src/`
in this repo now live in a separate repo,
[`openinvoicexml-web`](https://github.com/HongbaeKim/openinvoicexml-web) — see that repo's
`docs/ARCHITECTURE.md` for its backend/frontend structure. The root-level `core/`, `adapters/`,
and `validators/` documented above are the standalone invoice engine with no dependency on that
web layer; `openinvoicexml-web` consumes this repo, not the other way around.

Browser applications use `openinvoicexml/browser` to run business-rule validation and generate
XML locally with `generateInvoiceXml()`. External validators are Node-only: a backend can pass
the exact generated XML to `validateXmlExternally()` (from `openinvoicexml/adapters`) for KoSIT
and Mustang validation. A future `openinvoicexml-web` flow (Roadmap Phase 6) is planned to
connect these steps: generate locally, optionally validate the exact XML on the backend, then
download the same XML.
