# Limitations

This document records what is explicitly **not supported** in the current version, and why.
It is updated as scope decisions are made — not just at release time.

---

## VAT Category Codes

### `L` (Canary Islands IGIC) and `M` (Ceuta/Melilla IPSI) — not supported

Both codes are part of the EN 16931 VAT category code list (UNTDID 5305) but are **out of scope** for this project.

- `L` — IGIC (Impuesto General Indirecto Canario): applies when the place of supply is the Canary Islands
- `M` — IPSI (Impuesto sobre la Producción, los Servicios y la Importación): applies when the place of supply is Ceuta or Melilla

These are Spanish special-territory taxes. A German freelancer or business would only encounter them in the rare case of supplying goods/services with a place of supply in those territories. German accounting software universally omits them for the same reason.

If this project ever expands toward a generic EN 16931 library (rather than a Germany-focused XRechnung engine), adding `L` and `M` to `VatCategoryCode` is a small change — but it would require corresponding test fixtures and KoSIT validation confirmation before being considered supported.

**Workaround:** Not applicable. If you need to issue an invoice with IGIC or IPSI, use general-purpose EN 16931 tooling.

### Category `S` rate is restricted to 19%/7% — historical and non-German rates not supported

`checkVatRateForCategory` (`validators/rules/vat-rate.ts`) only accepts `19` or `7` for category `S` (`STANDARD_VAT_RATES`). Germany's COVID-era rates (16%/5%, July–December 2020) and other EU member states' EN 16931 standard/reduced rates are rejected as `VAT_RATE_INVALID_FOR_CATEGORY`.

**Workaround:** Not applicable today. Adding support means widening `STANDARD_VAT_RATES` plus a corresponding test fixture and KoSIT validation confirmation — tracked as a future extension, not current behavior.

---

## Output Formats

### XML (XRechnung UBL 2.1) — implemented, KoSIT-validated

`adapters/xrechnung.ts` (Week 5) generates UBL 2.1 XML for all 6 current fixtures, and
`make validate-kosit` (Week 6) confirms zero KoSIT `error`-severity findings for each. VAT
rule enforcement beyond what KoSIT's Schematron checks (§13b subcases, further business
rules) remains **Phase 2, Week 7**. Legal scenarios beyond the current 6 fixtures (§19,
credit notes, down payments, etc.) remain **Phase 3**.

### Hybrid PDF/A-3 (Factur-X / ZUGFeRD) — not yet implemented

Hybrid export is the deliverable of **Phase 4** (Weeks 13–16).

---

## Legal Scenarios

The following scenarios are known and planned but not yet implemented:

| Scenario | Planned phase |
|---|---|
| §19 UStG (Kleinunternehmerregelung — small business exemption) | Phase 3 |
| §13b UStG reverse charge subcases | Phase 3 |
| Intra-EU supply (VAT category K) | Phase 3 |
| Export outside EU (VAT category G) | Phase 3 |
| Credit notes (document type 381) | Phase 3 |
| Corrective invoices (document type 384) | Phase 3 |
| Down payment / final invoices | Phase 3 |
| Mixed VAT rates on a single invoice | Phase 3 |

---

## Validator Integration

KoSIT validator integration landed in **Phase 2, Week 6** (`validators/kosit.ts`, `make
validate-kosit`) — see [`VALIDATION.md`](VALIDATION.md) for setup and usage. All 6 current
fixtures pass with zero `error`-severity findings.

The `BusinessRuleValidator` (`validators/business-rules.ts`, added in Week 3) checks VAT
category/rate consistency, §13b reverse-charge requirements, exemption reasons, and EN 16931
rounding/amount consistency directly on the internal `Invoice` model. This is independent of and
does not replace KoSIT: it catches business-rule violations before XML generation runs, while
KoSIT confirms full XRechnung Schematron/XSD conformance of the generated XML itself.

As of Week 7, `generateInvoice()` (`adapters/generate-invoice.ts`) composes the two: it runs
`validateBusinessRules()` and only produces XML if there are no error-severity issues, returning
`{ xml, issues }` rather than throwing. `toXRechnung()` remains available standalone — unchecked,
always produces XML — for callers who validate separately or via their own pipeline.

### Accepted KoSIT notices

- **`BR-DE-TMP-32`** (severity: `information`, not blocking) — all 6 fixtures omit a
  delivery/service date (BT-72 "Actual delivery date", BG-14 "Invoicing period", or a
  per-line BG-26 "Invoice line period"). This is a national-extension recommendation, not
  a hard requirement; adding a delivery date field is left for a future fixture/scenario
  rather than blocking Week 6. Fixtures generated so far are still accepted by KoSIT
  despite this notice.
