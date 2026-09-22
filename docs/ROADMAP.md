# Roadmap

From 2028 onward, all domestic B2B invoices in Germany must be issued as a structured electronic
invoice (e.g., XRechnung XML). Hybrid PDF/A-3 (Factur-X/ZUGFeRD) is a combined human-readable and
machine-readable e-invoice format (PDF with embedded XML).

## Work Packages

| Work Package                           | Period                 | Focus                                                               | Status |
| -------------------------------------- | ---------------------- | -------------------------------------------------------------------- | ------ |
| WP1 – Architecture & Internal Schema   | Weeks 1–4              | Internal schema design, repo setup, modular architecture foundation | Done |
| WP2 – XML Engine & Validation          | Weeks 5–8              | XRechnung generation + local validation                             | Done |
| WP3 – Legal Compliance & Test Fixtures | Weeks 9–12             | VAT scenarios, invoice types, fixture validation                    | Done (through Week 11 — see below) |
| WP4 – Hybrid PDF/A-3 Export            | Weeks 13–16            | Hybrid export + profile support                                     | Done |
| WP5 – Stabilization & Release Prep     | Weeks 17–26            | Testing, documentation, hardening, release prep                     | Not started |

---

## Phases 1–4 — done

Current implemented state is documented where it actually lives, not repeated here:
[`ARCHITECTURE.md`](ARCHITECTURE.md) (schema/module design), [`DATA-MODEL.md`](DATA-MODEL.md)
(BT mapping), [`LIMITATIONS.md`](LIMITATIONS.md) (what's supported/not, per scenario).

- **Phase 1 (Weeks 1–4):** Repo skeleton, internal invoice schema v0.1, `ARCHITECTURE.md`/
  `ROADMAP.md`/`DEVELOPMENT.md`/`LIMITATIONS.md` written. Tagged v0.1.0.
- **Phase 2 (Weeks 5–8):** XRechnung UBL 2.1 XML adapter, KoSIT validator integration,
  `validateBusinessRules()` + `generateInvoice()` pipeline, CI (`test`/`typecheck`/
  `validate-kosit`). Beta signup form and `openinvoicexml.de` shipped ahead of schedule as
  parallel frontend work. Tagged v0.2.0.
- **Phase 3 (Weeks 9–12):** §19 small-business, §13b reverse-charge subcases, intra-EU supply,
  export, place-of-supply warning, credit notes/corrective invoices, down-payment/final/partial-
  delivery invoices. 21 fixtures, all passing KoSIT. Tagged v0.3.0. Remaining: 30+ fixture target
  and the broader edge-case sweep (mixed VAT rates, invoice with surcharge, PO reference, etc.)
  are not yet done.
- **Phase 4 (Weeks 13–16):** Hybrid PDF/A-3b export, a CII adapter plus genuine Factur-X/ZUGFeRD
  hybrid PDF (`EN16931`/`XRECHNUNG` profiles), Mustang cross-validation, unified `ComplianceIssue`
  diagnostics, and edge-case hardening. 50 fixtures, all passing KoSIT + veraPDF + Mustang. Tagged
  v0.4.0. Remaining: `MINIMUM`/`BASIC WL`/`BASIC` profiles, tracked in `.step/longtermplan.md`.

---

## Phase 4 – Hybrid PDF/A-3 Export (Weeks 13–16, done)

**Deliverable:** Stable hybrid PDF/A-3 export with Factur-X/ZUGFeRD profile support, validated
across 40+ scenarios.

- **Week 13:** PDF/A-3b generation module; embed XRechnung XML as an attachment
  (`AFRelationship = Alternative`); correct XMP/ZUGFeRD metadata.
- **Week 14:** Validate against veraPDF; fix conformance errors; confirm two independent tools
  can extract/re-validate the embedded XML.
- **Week 15:** Support EN 16931/XRECHNUNG profiles via a real CII adapter (needed for genuine
  Factur-X/ZUGFeRD, not just an XMP parameter); validate 20+ fixtures with veraPDF and KoSIT.
  MINIMUM/BASIC WL/BASIC deferred — see [`LIMITATIONS.md`](LIMITATIONS.md).
- **Week 16:** Reach 40+ validated scenarios; test edge cases (long descriptions, umlauts, 50+
  line items); structured compliance-error diagnostics. Tag v0.4.0.

## Phase 5 – Stabilization & Release Prep (Weeks 17–26, in progress)

**Deliverable:** Production-ready open-source prototype.

- **Weeks 17–18:** Unified test suite (schema/XML/hybrid), 50+ fixture regression coverage,
  rounding/edge-VAT-case stabilization. Week 17 done: 50 fixtures wired into every "all fixtures"
  test via `fixtures/index.ts`, KoSIT validation batched into one JVM call, and v8 coverage
  thresholds enforced in CI (`npm run test:coverage`). Rounding/edge-VAT hardening (Week 18) remains.
- **Week 19:** Security pass — file handling, input sanitization, malformed-input handling,
  dependency audit. Feeds into `SECURITY.md`.
- **Week 20:** Finalize `API.md`, `ARCHITECTURE.md`, `LIMITATIONS.md`; German translation of key
  docs.
- **Week 21:** Performance/stress testing (100/500/1000-line invoices, batch generation);
  document baselines. In parallel, a disposable browser invoice-UI spike (in
  [`openinvoicexml-web`](https://github.com/HongbaeKim/openinvoicexml-web)) prototypes a
  stateless download/upload-XML workflow — a few days of additive work, not part of Week 21's
  committed hours, de-risking the public-facing invoice UI planned for the Second Stage.
- **Week 22:** Code-quality pass — module boundaries, comments, naming. No new features.
- **Week 23:** Final KoSIT/veraPDF verification across all fixtures and profiles.
- **Week 24:** Finalize `DEVELOPMENT.md`, contributor onboarding, example usage docs, FAQ.
- **Week 25:** Full regression pass, issue triage, release notes, reviewer feedback.
- **Week 26:** Scope freeze, tag v1.0.0-prototype, publish release + funding summary.

---

## Second Stage – Phases 6–10 (hosted public web service)

> **Status: not yet selected — planned only.** Phases 1–5 above are the committed scope. Second
> Stage depends on a go/no-go decision after v1.0.0-prototype, informed by demand-validation
> signals (beta/developer signups, site traffic) and funding availability. Provisional, not a
> commitment.

| Phase                                                   | Focus                                                          | Period                        |
| -------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------ |
| Phase 6 – Public Service & Invoice UI                   | Build the browser invoice workflow, wire it to the engine, minimal deploy | Weeks 27–29 (30 Nov – 20 Dec)  |
| Phase 7 – Sustainability & Community / Onboarding Refinement | Simplify existing guidance, short usage videos, refine FAQ      | Weeks 30–31 (21 Dec – 3 Jan)   |
| Phase 8 – User Testing & Public Beta                    | Structured public beta, usability interviews, feedback-driven fixes | Weeks 32–38 (4 Jan – 21 Feb)   |
| Phase 9 – API Reuse & Partnerships                      | API documentation, pilot integrations, partner outreach         | Weeks 39–42 (22 Feb – 21 Mar)  |
| Phase 10 – Evaluation & Finalization                    | Evaluate beta results, document findings, final reporting       | Week 43 (22 Mar – 28 Mar)      |

The beta program (`beta.html`) and developer feedback form (`developer.html`), both in
[`openinvoicexml-web`](https://github.com/HongbaeKim/openinvoicexml-web), collect early signups
ahead of Phase 6; site traffic and signup volume are the demand-validation signal for whether
the hosted service is worth the funded build-out.
