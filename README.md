# openinvoicexml

An open-source TypeScript library for generating compliant German electronic invoices — XRechnung XML and hybrid PDF/A-3 (Factur-X/ZUGFeRD).

From 2028 onward, all domestic B2B invoices in Germany must be issued as structured electronic invoices. This library handles the full pipeline: structured JSON input → validated XRechnung XML → hybrid PDF with embedded XML.

Funded by [Prototype Fund](https://www.prototypefund.de/projects/openinvoicexml) (June–November 2026).

## What it does

- Generates XRechnung 3.x compliant UBL 2.1 XML from a structured JSON invoice
- Validates output against KoSIT (the official German e-invoice validator)
- Exports hybrid PDF/A-3b with embedded XML (Factur-X/ZUGFeRD profiles)
- Covers major German VAT and legal scenarios: §19 small business, §13b reverse charge, intra-EU supply, credit notes, down payment invoices, and more

## Status

Early development — Phase 1 (Architecture & Internal Schema) in progress. See [docs/ROADMAP.md](docs/ROADMAP.md) for the full plan.

## Prerequisites

- Node.js 20+
- npm 10+

## Install

```bash
npm install
```

## Run tests

```bash
npm test
```

## Project structure

```
/core         — internal invoice schema and normalization
/adapters     — output adapters (XRechnung XML, PDF/A-3)
/validators   — validation layer (schema, KoSIT, veraPDF)
  /rules      — individual business rule implementations
/fixtures     — example invoices and expected outputs
/docs         — architecture, roadmap, and API docs
```

## Docs

| Document | Status |
|---|---|
| `SCHEMA.md` — Internal invoice schema, field definitions, BT mapping | Done |
| `ARCHITECTURE.md` — Adapter pattern, module boundaries, data flow | Done |
| `MAPPING.md` — Full XRechnung BT mapping table | Week 5 |
| `ROADMAP.md` — Phase goals, non-goals, open questions | Done |
| `CONTRIBUTING.md` — How to contribute, coding conventions | Done |
| `LIMITATIONS.md` — What is not supported and why | Done |
| `PROTOTYPEFUND.md` — Prototype Fund bi-weekly progress report | Active |
| `DEPENDENCIES.md` — Purpose of each dependency in `package.json` | Done |
| `TSCONFIG.md` — Explanation of each `tsconfig.json` compiler option | Done |

## License

Apache-2.0
