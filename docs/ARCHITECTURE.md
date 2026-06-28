# Architecture

This document describes the architecture of `openinvoicexml`: how the modules fit together, how data flows through the system, and why the design decisions were made.

---

## Design Principle

The project is built around a **single internal schema** that serves as the source of truth for all invoice data. Every downstream module — validators, XML adapters, PDF adapters — reads only from this schema. No adapter ever touches raw user input directly.

This decoupling means:

- Input formats can change without touching output logic.
- Output adapters can be added, removed, or replaced independently.
- Validation runs against one consistent representation, not format-specific quirks.

---

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
                          │  (AJV)           │
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
                        ┌──────────┴──────────┐
                        ▼                     ▼
               ┌─────────────────┐   ┌─────────────────┐
               │  XRechnung XML  │   │  Hybrid PDF/A-3 │
               │  adapter        │   │  adapter         │
               │  (Phase 2)      │   │  (Phase 4)       │
               └─────────────────┘   └─────────────────┘
```

1. **Input** arrives as a JSON object matching `schemas/invoice.schema.json`.
2. **Schema validation** (AJV) checks structural completeness: required fields, types, formats, enums, value constraints.
3. The validated object becomes an **internal `Invoice`** — a TypeScript interface with typed fields mapping to XRechnung Business Terms.
4. **Business rule validation** checks legal/arithmetic correctness: VAT category consistency, §13b reverse-charge requirements, EN 16931 rounding rules, and document-level total coherence.
5. **Output adapters** transform the validated invoice into a target format. Each adapter is independent — adding or replacing one never touches the others.

---

## Module Map

```
openinvoicexml/
├── core/              Internal invoice model
├── schemas/           JSON Schema (machine-readable contract)
├── validators/        Validation logic (schema + business rules)
├── adapters/          Output format adapters (XML, PDF)
├── fixtures/          Example invoice JSON files
└── docs/              Project documentation
```

### `core/`

TypeScript type definitions for the internal invoice model. This is the contract that all other modules depend on.

| File | Purpose |
|---|---|
| `types/invoice.ts` | `Invoice` interface — the root type with document-level fields (BT-1 through BT-115) |
| `types/invoice-line.ts` | `InvoiceLine` interface — a single line item (BG-25) |
| `types/party.ts` | `Party` interface — seller or buyer with address and identifiers (BG-4/BG-7) |
| `types/vat-breakdown.ts` | `VatBreakdown` interface and `VatCategoryCode` union type (BG-23) |
| `utils/monetary.ts` | `round2()` and `isClose()` — monetary rounding and comparison with EN 16931 tolerance |
| `index.ts` | Re-exports all public types |

`core/` has **no dependencies** on any other module. It is pure types and utility functions.

### `schemas/`

| File | Purpose |
|---|---|
| `invoice.schema.json` | JSON Schema (Draft-07) defining the structure of a valid invoice |

The schema mirrors the TypeScript types in `core/` but is language-independent. It is used by AJV at runtime for validation and serves as machine-readable documentation of the invoice format. The schema enforces:

- Required fields and their types
- String formats (ISO 8601 dates, ISO 4217 currency codes, ISO 3166-1 country codes)
- Enum constraints (invoice type codes, VAT category codes)
- Numeric bounds (VAT rate 0–100, quantities > 0)
- `additionalProperties: false` at every level to catch typos

### `validators/`

Two validation layers, each catching a different class of error:

| File | Purpose |
|---|---|
| `types.ts` | `ValidationIssue` interface — the return type for all validation |
| `business-rules.ts` | `validateBusinessRules()` — checks legal and arithmetic rules |
| `rules/vat-rate.ts` | VAT rate/category consistency rules, decimal precision check |
| `index.ts` | Re-exports public API |

**Schema validation** (AJV + `invoice.schema.json`) catches structural errors: missing fields, wrong types, invalid formats.

**Business rule validation** (`validateBusinessRules()`) catches legal errors that valid JSON can still contain:

- VAT rate must match category (S requires positive rate; Z/E/AE/K/G/O require 0%)
- Reverse charge (AE) requires buyer VAT ID (§13b UStG)
- Exemption categories (E/AE/K/G/O) require an exemption reason (BT-120 or BT-121)
- Line amounts must equal quantity × unit price (within rounding tolerance)
- VAT breakdown taxable amounts must equal the sum of matching line amounts
- Document-level totals must be internally consistent (BT-109, BT-110, BT-112, BT-115)
- All monetary amounts must have at most 2 decimal places

Validators return `ValidationIssue[]` — a flat array of plain objects. They never throw exceptions. Callers decide how to handle issues (log, display, block output).

### `adapters/`

Output adapters transform a validated `Invoice` into a specific format. Currently a skeleton — adapters are implemented in later phases:

- **XRechnung XML adapter** (Phase 2, Weeks 5–8): UBL 2.1 XML conforming to XRechnung 3.x
- **Hybrid PDF/A-3 adapter** (Phase 4, Weeks 13–16): PDF/A-3b with embedded XRechnung XML (Factur-X/ZUGFeRD)

Each adapter is an independent module. Adding a new output format means adding a new adapter — no changes to `core/`, `schemas/`, or `validators/`.

### `fixtures/`

Example invoice JSON files that validate against the schema. Each fixture represents a distinct legal scenario:

| Fixture | Scenario |
|---|---|
| `domestic-simple.invoice.json` | Standard domestic invoice, 19% VAT (S) |
| `domestic-multi-line.invoice.json` | Multiple line items, 19% VAT (S) |
| `reduced-rate.invoice.json` | Reduced 7% VAT rate (S) |
| `zero-rated.invoice.json` | Zero-rated supply (Z) |
| `exempt.invoice.json` | VAT-exempt supply (E) |
| `reverse-charge.invoice.json` | §13b reverse charge (AE) |

Fixtures serve three purposes: test inputs for automated tests, reference implementations for contributors, and documentation of supported scenarios.

---

## Key Decisions

### JSON Schema as the structural contract

The invoice structure is defined in JSON Schema (`schemas/invoice.schema.json`), not in a TypeScript-only validation library like Zod or io-ts.

**Why:** JSON Schema is language-independent. The schema can be consumed by tools in any language, used for code generation, embedded in API documentation, or handed to non-TypeScript collaborators. The TypeScript types in `core/` mirror the schema for compile-time safety, but the schema is the authority.

### No runtime dependencies

The engine has zero production dependencies. All dependencies (`ajv`, `vitest`, `eslint`, `prettier`, `typescript`) are devDependencies used only for development and testing.

**Why:** A zero-dependency library is easier to embed, audit, and trust. Invoice processing is a sensitive domain — every dependency is a supply chain risk. Runtime dependencies will only be added when genuinely necessary (e.g., an XML serialization library in Phase 2).

### Validation returns data, not exceptions

`validateBusinessRules()` returns `ValidationIssue[]` instead of throwing. Each issue is a plain object with `code`, `severity`, `message`, and `path`.

**Why:** Invoices can have multiple independent errors. Throwing on the first one forces the caller into a try-catch-fix-retry loop. Returning all issues at once lets callers display a complete error report, batch-process fixes, or selectively ignore warnings.

### VAT rate is not hardcoded to German rates

Category "S" (standard rate) accepts any positive rate, not just 19% or 7%.

**Why:** Germany temporarily used 16%/5% during COVID (July–December 2020). Historical invoices with those rates must validate. The engine should also work for other EU member states that use EN 16931 with different rates.

### Adapter pattern for output formats

Each output format is a separate adapter module that depends only on `core/` types. Adapters do not depend on each other.

**Why:** XRechnung XML and PDF/A-3 have completely different generation logic, dependencies, and validation toolchains (KoSIT vs. veraPDF). Coupling them would make both harder to test and maintain. The adapter pattern also makes it straightforward to add future formats (e.g., UN/CEFACT CII XML) without touching existing code.

---

## What This Architecture Does Not Include

These are explicitly out of scope for the current design:

- **Input adapters** (CSV import, REST API, GUI) — the engine accepts JSON objects directly. Input adapters are a consumer-side concern.
- **Persistence / database** — invoices are stateless objects. Storage is a consumer-side concern.
- **Authentication / multi-tenancy** — this is a library, not a web service.
- **Localization** — field names and error messages are in English. German legal terms are referenced in documentation but not in the API surface.
