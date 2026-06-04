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

---

## Output Formats

### XML (XRechnung UBL 2.1) — not yet implemented

XML generation is the deliverable of **Phase 2** (Weeks 5–8). The current codebase defines the internal invoice schema only.

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

KoSIT validator integration is the deliverable of **Phase 2, Week 6**. Until then, generated XML (once available) is not automatically verified against the official XRechnung Schematron rules.
