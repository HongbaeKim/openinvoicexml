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

- [Architecture](docs/ARCHITECTURE.md) — adapter pattern, module boundaries, data flow
- [Roadmap](docs/ROADMAP.md) — phases, milestones, week-by-week plan
- [Limitations](docs/LIMITATIONS.md) — what is not supported and why
- [Contributing](CONTRIBUTING.md) — how to contribute

## License

Apache-2.0
