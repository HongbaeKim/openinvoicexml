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

1. **Input** arrives as JSON matching `schemas/invoice.schema.json`.
2. **Schema validation** (consumer-side, not run by this package at runtime) checks structural
   completeness — see "No runtime dependencies" below.
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
| `validators/` | `validateBusinessRules()` + per-scenario `rules/*.ts`, plus `runKosit()` for external XML validation                     |
| `adapters/`   | Output adapters — XRechnung UBL XML, CII XML, and two hybrid PDF/A-3 entry points, all implemented                       |
| `fixtures/`   | Example invoice JSON files, one per legal scenario — see [`fixtures/README.md`](../fixtures/README.md) for the full list |
| `docs/`       | Project documentation                                                                                                    |

### `validators/`

Three layers, each catching a different class of error:

- **Schema validation** (`invoice.schema.json`) — structural errors: missing fields, wrong
  types, invalid formats. Not run automatically by this package; a consumer with untyped JSON
  input validates it themselves before constructing an `Invoice`.
- **Business rule validation** (`validateBusinessRules()`, in `engines/02.business-rules.ts` +
  `rules/*.ts`) — legal errors valid JSON can still contain: VAT rate/category consistency,
  reverse-charge/exemption requirements, line and document total arithmetic. Returns
  `ValidationIssue[]`, never throws.
- **KoSIT validation** (`engines/90.kosit.ts`) — a separate, external mechanism confirming the generated
  XML conforms to the XRechnung XSD/Schematron. See
  [`COMPLIANCE.md`](COMPLIANCE.md#validating-this-projects-output).
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
- **CII XML adapter** — implemented: UN/CEFACT Cross Industry Invoice XML, profile-aware
  (`EN16931`/`XRECHNUNG`, selecting which `GuidelineSpecifiedDocumentContextParameter` URN gets
  written). `cii-mapping.ts` + `cii.ts` mirror the XRechnung adapter's own split. Required because
  every Factur-X/ZUGFeRD conformance level needs CII, not UBL — `toXRechnung()` can't serve that
  role. See [`API.md`](API.md).
- **Hybrid PDF/A-3 adapter** — implemented, two entry points sharing one visual-layout helper
  (`buildInvoicePages()` in `hybrid-pdf.ts`) but branching at the end: `toHybridPdf()` embeds the
  UBL XML as a plain associated file (no Factur-X/ZUGFeRD claim); `toFacturXPdf()` embeds the CII
  XML via `@cantoo/pdf-lib`'s `embedFacturX()` (`fx:` XMP metadata, a genuine conformance claim).
  `generate-invoice.ts` composes `validateBusinessRules()` with each behind
  `generateHybridPdf()`/`generateFacturXPdf()`. See [`API.md`](API.md).

---

## Key Decisions

- **JSON Schema, not TypeScript-only validation** — language-independent, so it can be consumed
  by non-TypeScript tooling and collaborators.
- **No runtime dependencies** — see below.
- **Validation returns data, not exceptions** — `validateBusinessRules()` returns
  `ValidationIssue[]` so callers can see every issue at once instead of catch-fix-retry.
- **`generateInvoice()` gates output on business-rule errors** — see [`API.md`](API.md) for the
  full contract.
- **Adapter pattern for output formats** — each format is an independent module depending only
  on `core/` types, so XML and PDF generation/validation stay decoupled.

### No runtime dependencies

The engine has exactly two production dependencies, both scoped solely to the hybrid PDF/A-3
adapter (`adapters/hybrid-pdf.ts`/`adapters/hybrid-pdf-mapping.ts`):
[`@cantoo/pdf-lib`](https://github.com/cantoo-scribe/pdf-lib) and
[`fontkit`](https://github.com/foliojs/fontkit) (the font engine `@cantoo/pdf-lib` requires,
registered via `PDFDocument.registerFontkit()`, to embed a custom TTF font — it doesn't bundle one
itself). PDF/A-3 conformance — font subsetting, ICC output intents, embedded-file attachments with
`AFRelationship`, XMP metadata — isn't something that can reasonably be hand-rolled the way
XRechnung's XML serialization was; these are a deliberate, narrowly scoped exception, not an
abandonment of the zero-dependency stance for the rest of the engine. `ajv`, `vitest`, `eslint`,
`prettier`, and `typescript` remain devDependencies used only for this repo's own build/test/lint,
not exported for consumers. `ajv` in particular is used solely inside
`validators/test/00.invoice-schema.test.ts` to check `schemas/invoice.schema.json` against
fixtures; it's not part of the runtime API. A consumer validating untyped JSON supplies their own
JSON Schema validator. **Why:** minimizing dependencies keeps the library easy to embed, audit,
and trust — invoice processing is a sensitive domain, and every dependency is a supply-chain
risk — so each one added, including this one, should be a deliberate, justified exception rather
than a default.

---

## Website and hosted backend

The website, beta/developer signup backend, and deploy tooling that used to live under `src/`
in this repo now live in a separate repo,
[`openinvoicexml-web`](https://github.com/HongbaeKim/openinvoicexml-web) — see that repo's
`docs/ARCHITECTURE.md` for its backend/frontend structure. The root-level `core/`, `adapters/`,
and `validators/` documented above are the standalone invoice engine with no dependency on that
web layer; `openinvoicexml-web` consumes this repo, not the other way around.
