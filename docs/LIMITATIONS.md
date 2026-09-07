# Limitations

What is explicitly **not supported** in the current version, and why. Full detail behind each
item (statutory citations, per-subcase eligibility conditions) is preserved in
`.step/privatedocs/LIMITATIONS.md` for future expansion — this page keeps only the summary.

## Not supported

| Item | Why / detail |
| --- | --- |
| VAT codes `L` (Canary Islands IGIC), `M` (Ceuta/Melilla IPSI) | Spanish special-territory taxes, out of scope for a Germany-focused engine |
| Category `S` rates other than 19%/7% | Historical (COVID-era 16%/5%) and non-German EN 16931 rates rejected as `VAT_RATE_INVALID_FOR_CATEGORY` — see [§12 UStG][ustg-12] |
| §19 UStG turnover conditions | Only checks a seller tax ID is present when §19 is referenced — doesn't verify the €25,000/€100,000 turnover thresholds or an Abs. 3 waiver |
| Export customs reference | No dedicated field — use `note` (BT-22) as a workaround |
| Place of supply — goods/B2C/special categories | Only the default + B2B-service-override rule is checked (`PLACE_OF_SUPPLY_CROSS_BORDER`, warning-only, never blocks). Goods vs. services, B2C, and special categories (real estate, transport, events, catering) aren't modeled — see [§3a UStG][ustg-3a] |
| Deliver-to city/postal code (`BR-DE-10`/`BR-DE-11`) | Only country code (BT-80) is enforced by the TS validator; a `deliverTo` address missing city/postal code passes here but is rejected by real KoSIT — populate them anyway |
| BT-10 buyer reference format (Leitweg-ID) | `validators/rules/19.xrechnung-mandatory-fields.ts` only checks that BT-10 is *present* when validated with `profile: "XRECHNUNG"` — it does not check Leitweg-ID structure/format, and doesn't distinguish B2G (where some recipients require a Leitweg-ID) from B2B (where XRechnung's own FAQ allows any suitable buyer-provided identifier) |
| Factur-X/ZUGFeRD hybrid profiles MINIMUM/BASIC WL/BASIC | These three are partial-data profiles by design — they deliberately *omit* content this project's `Invoice` model always carries, so supporting them needs a profile-aware serializer that knows what to leave out, not just a different `GuidelineSpecifiedDocumentContextParameter` value the way `EN16931`/`XRECHNUNG` did. Those two profiles are implemented (`adapters/cii.ts`'s `toCii()`, `adapters/hybrid-pdf.ts`'s `toFacturXPdf()`) and validated against KoSIT, veraPDF, Mustang, and FeRD's own D22B EN16931 artifacts — see [`COMPLIANCE.md`](COMPLIANCE.md#validating-factur-xzugferd-output-cii). MINIMUM/BASIC WL/BASIC remain a distinct follow-up, tracked in `.step/longtermplan.md`, not this file's per-week roadmap |

## §13b UStG reverse-charge subcases

German law recognizes 14 subcases (§13b Abs. 1 + Abs. 2 Nr. 1–12).
`validators/rules/15.reverse-charge.ts` models 13 of them via a `reverseChargeReason` tag with a
free-text keyword check (VATEX has no per-subcase code, so `AE`/`VATEX-EU-AE` stay generic). A
matching tag is necessary but **not sufficient** proof reverse charge actually applies — e.g.
`mobile-devices`/`industrial-metals` also require a €5,000 transaction minimum, which isn't
verified here.

| `reverseChargeReason` value | Fixture? |
| --- | --- |
| `construction` | **Yes** |
| `scrap-and-waste` | **Yes** |
| `security-transfer` | **Yes** |
| `cleaning` | **Yes** |
| `mobile-devices` | **Yes** |
| `gas-and-electricity` | **Yes** |
| `eu-cross-border-service` | **Yes** |
| `real-estate` | **Yes** |
| `telecommunications` | **Yes** |
| `foreign-supplier`, `emission-certificates`, `qualifying-gold`, `industrial-metals` | No fixture yet — logic exists, exercise directly via `reverseChargeReason` |

One remaining real-world subcase (insolvency-specific security-asset transfers) has no dedicated
identifier — falls back to the generic `AE` checks only.

## Output formats

- **XML (XRechnung UBL 2.1)** — implemented, all current fixtures pass KoSIT with zero
  `error`-severity findings.
- **Hybrid PDF/A-3, UBL (`toHybridPdf()`)** — implemented (`adapters/hybrid-pdf.ts`). The current
  hybrid PDFs pass veraPDF's PDF/A-3b profile with zero errors across all fixtures.
  `make validate-mustang` independently confirms, via the Mustang Project CLI (a third-party
  tool, not this project's own code), that all 30 fixtures' embedded XML extracts byte-for-byte
  identically to `toXRechnung()` and passes Mustang's own EN16931/XRechnung UBL validation with
  zero errors. Not a Factur-X/ZUGFeRD hybrid — it embeds UBL, and every ZUGFeRD/Factur-X
  conformance level requires CII.
- **Hybrid PDF/A-3, Factur-X/ZUGFeRD (`toFacturXPdf()`)** — implemented (`adapters/hybrid-pdf.ts`,
  `adapters/cii.ts`), `EN16931`/`XRECHNUNG` profiles only (see "Not supported" above for
  MINIMUM/BASIC WL/BASIC). Sets `fx:ConformanceLevel`/`fx:DocumentFileName` XMP via
  `embedFacturX()` — a genuine conformance claim. `make validate-facturx` confirms, per profile
  across all 30 fixtures: veraPDF PDF/A-3b conformance, KoSIT conformance of the extracted
  `factur-x.xml`, and `runMustang()` validating the PDF directly (no extraction) with zero
  errors. See [`COMPLIANCE.md`](COMPLIANCE.md#validating-factur-xzugferd-output-cii).

## Legal scenarios

| Scenario | Status | Caveat |
| --- | --- | --- |
| Credit notes (`381`) | Implemented | No cross-check of credited amounts against the original invoice |
| Corrective invoices (`384`) | Implemented | "Only changed lines present" is a fixture-authoring convention, not enforced |
| Down payment / final invoice | Implemented | `precedingInvoiceReference` is a single reference — one prior down payment per final invoice |
| Partial delivery (Teilrechnung) | Implemented | No dedicated fields for overall contract value / remaining balance (no EN 16931 BT exists for either) — stated in free-text `note` instead |

## Accepted KoSIT notices

- **`BR-DE-TMP-32`** (severity: `information`, not blocking) — most fixtures omit a
  delivery/service date; this is a recommendation, not a hard requirement, and doesn't fail
  validation. For category `K` (intra-EU supply), `BR-IC-11` makes BT-72 mandatory instead — see
  `validators/rules/13.intra-eu.ts`.

[ustg-12]: https://www.gesetze-im-internet.de/ustg_1980/__12.html
[ustg-3a]: https://www.gesetze-im-internet.de/ustg_1980/__3a.html
