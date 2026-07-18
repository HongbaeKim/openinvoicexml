# Updates

Updated every two weeks. Most recent entry first.

## In plain language

The section below (and every dated entry further down) is written for a technical reader.
This one covers the same two-week period in plain language, for anyone following along
without a software background.

**Done** (6 July – 19 July)
- Connected the project to the official German government tool that checks whether a
  generated e-invoice actually meets the legal format requirements — this now runs
  automatically every time the invoice-generation code changes, instead of needing a manual
  check
- Made the tax-rate checking stricter: invoices at the standard German VAT rate now have to
  show exactly 19% or 7% — anything else gets flagged instead of silently allowed through
- The system now refuses to produce an invoice at all if it would break a legal rule, instead
  of producing something incorrect and only warning about it separately
- Automated tests confirm all of the above still works correctly (84 checks, all passing)
- Launched two sign-up forms on the website — one for people who want to use the tool once
  it's available, one for developers who want to build on top of it — with spam protection
  and a GDPR-compliant consent step
- The website is now available in both German and English, with a switcher in the header
- Strengthened the security of the server that runs the website (encryption settings,
  protective headers, limits on how fast someone can submit a form) and wrote up the
  reasoning for later reference
- **The website, openinvoicexml.de, is now publicly live** — both the site itself and the
  sign-up forms were deployed to the real server, tested live, and confirmed working
  end-to-end, including actually submitting a test sign-up and seeing it stored correctly
- Wrote documentation explaining how sign-up data is stored and how duplicate sign-ups are
  handled

**Doing** (20 July – 2 Aug)
- Setting up automatic checks that run every time the code changes, to catch mistakes as
  early as possible (this was planned for the last two weeks but got pushed back on purpose,
  not forgotten)
- Polishing the invoice-generation engine and publishing the next official version
- Starting work on more complex German tax-law scenarios: small-business rules, trade within
  the EU, and exports outside the EU

**Motivations & challenges**
- Motivation: the system should never be able to silently produce an incorrect invoice — it's
  better for it to refuse and explain why than to hand back something that looks fine but
  breaks a legal rule
- Challenge: putting the website on the real server surfaced problems that testing on a
  laptop never would have — the server initially couldn't start because something unrelated
  was already using the same address, a set of login details stopped matching after being
  updated, and one page of the site wasn't loading correctly at first. All three were caught
  and fixed only by actually testing the live site, not just reviewing the code — a reminder
  that "deployed" and "confirmed working" aren't the same thing
- Challenge: originally planned to host the website through a separate free hosting service,
  but changed course partway through in favor of hosting it directly alongside the rest of
  the project on the same server — simpler to maintain going forward, at the cost of some
  rework mid-task

---

**Done** (6 July – 19 July)
- Integrated the KoSIT validator (`validators/kosit.ts`, `make validate-kosit`) as an automated validation step; documented setup and usage in `docs/VALIDATION.md`
- Tightened VAT rule enforcement: category `S` (standard rate) now requires exactly 19% or 7% (`STANDARD_VAT_RATES`), not just `rate > 0`
- Extended `kosit.test.ts` to run all 6 fixtures through the real KoSIT validator as part of `npm test`, not just the manual `make validate-kosit` step
- Wired business-rule validation into the generation path: new `generateInvoice()` (`adapters/generate-invoice.ts`) runs `validateBusinessRules()` and only produces XML when there are no error-severity issues, returning `{ xml, issues }` instead of throwing; `toXRechnung()` remains available standalone for callers who validate separately. Documented in `docs/LIMITATIONS.md`
- Full suite green: 84 tests passing across schema validation, business rules, the XRechnung adapter, `generateInvoice`, and all 6 fixtures through the real KoSIT validator with zero errors
- Built the beta program (`beta.html`) and developer feedback (`developer.html`) landing pages ahead of schedule (normally Phase 7 scope) — React + Vite + Fastify + Postgres, GDPR-compliant consent flow, honeypot spam protection, duplicate-signup detection via a DB-level `UNIQUE` constraint on email
- Added a DE/EN language switcher (custom, no i18n library) across all 5 site pages, plus a funder-logo footer redesign (BMFTR / Prototype Fund)
- Hardened the reverse-proxy layer (TLS pinning, security headers, rate limiting) and documented the reasoning in `docs/SECURITY.md`
- **Opened `openinvoicexml.de` to the public**: deployed the frontend and API to the production VPS — served from the same VPS's nginx alongside the API (reconsidered a planned GitHub Pages deploy in favor of one less external dependency), bootstrapped TLS certs for both domains, fixed a production CORS/DB-credential mismatch surfaced by live testing, and automated cert renewal via cron. Verified live end-to-end, including both signup forms actually submitting successfully. Satisfies `ROADMAP.md`'s Week 7 note to open the site once DNS/VPS deployment is complete
- Documented the database schema and duplicate-signup handling in a new `docs/DBSTRUCTURE.md`

**Doing** (20 July – 2 Aug)
- Add the CI workflow (`.github/workflows/ci.yml`: lint + typecheck + test) — explicitly deferred from Week 7, not forgotten
- Stabilize XML generation and tag release `v0.2.0` (Week 8)
- Begin Phase 3: §19 small-business regulation, §13b reverse-charge subcases, intra-EU supply, export, and place-of-supply rules (Week 9)

**Motivations & challenges**
- Motivation: making `generateInvoice()` block on error-severity business-rule issues by default, rather than leaving validation opt-in, closes a gap the roadmap flagged — a caller can no longer silently produce non-compliant XML without realizing it
- Challenge: the VPS deployment surfaced problems no amount of local testing would have caught — an unrelated system service already occupying ports 80/443, a Postgres password that silently stopped matching once `.env` was edited after first boot, and an nginx rule that 404'd the site root while every other page worked fine. All three were found and fixed via actual live-traffic verification (curl and a real browser click-through), a reminder that "deployed" and "verified working end-to-end" are different milestones
- Challenge: deciding where to run the frontend (GitHub Pages vs. the existing VPS) mid-implementation cost some rework, but landed on the simpler long-term answer — one less external dependency, one less DNS target, no separate deploy pipeline to maintain
---

**Done** (22 Jun – 5 July)
- Wrote `docs/ARCHITECTURE.md` and `docs/CONTRIBUTING.md`: adapter pattern, module boundaries, and the contributor workflow
- Added `CHANGELOG.md` and tagged release `v0.1.0`
- Implemented the XRechnung UBL 2.1 XML adapter (`adapters/xrechnung.ts`): maps document header, seller/buyer parties, payment means, VAT totals, and invoice lines to XRechnung 3.x elements, with XML-escaping and 2-decimal amount formatting
- Wrote `adapters/xrechnung.test.ts`: structural smoke tests across all 6 fixtures, field-mapping tests, and an XML-escaping test (14 tests)
- Wired `adapters/index.ts` to export `toXRechnung`
- Documented the BT → internal field → UBL element mapping in `docs/MAPPING.md`
- Added `Makefile` `generate` and `validate-xml` targets: generate XML for all 6 fixtures into `dist/xml/` and check well-formedness
- Full suite green: 68 tests passing across schema validation, business rules, and the XRechnung adapter

**Doing** (6 July – 19 July)
- Integrate the KoSIT validator (`validationtool`) as an automated validation step, run all XML fixtures through it, and fix structural validation errors
- Document KoSIT setup (Java version, scenario download, local run instructions) in the README developer section
- Implement structured VAT rule enforcement (category/rate consistency, reverse-charge buyer VAT ID, EN 16931 rounding tolerance) with automated test cases

**Motivations & challenges**
- Motivation: building the XML adapter only after the schema/validators were stable let it trust a fully-validated `Invoice` object, keeping the zero-runtime-dependency, template-string approach auditable
- Challenge: UBL 2.1's strict element ordering (e.g. `TaxExemptionReasonCode` before `TaxExemptionReason`, `Item/Description` before `Item/Name`) meant early XML drafts were schema-invalid despite correct data — required careful sequencing ahead of Week 6's KoSIT validation
- Challenge: settling where generated docs (`CHANGELOG.md`) should live took a few false starts — moved to `docs/` and back to the repo root before landing on root-level, matching where `README.md` and `LICENSE` already live

---

**Done** (8 Jun – 21 Jun)
- Drafted internal invoice schema v0.1 as a JSON Schema Draft-07 document (`schemas/invoice.schema.json`), covering all mandatory XRechnung Business Terms (BT-1 through BT-115) with field-level descriptions linking each field to its EU/German legal basis
- Added 2 example invoice JSON fixtures: a simple single-line domestic invoice and a multi-line invoice with a purchase order reference — both validate against the schema
- Wrote 33 schema validation tests with Vitest + AJV v8: 2 valid-fixture tests and 31 rejection tests covering missing required fields, wrong formats, invalid enumerations, extra properties, and multi-line-specific edge cases; all pass in CI
- Added `docs/SCHEMA.md` documenting field naming conventions, the full BT mapping table, VAT category codes, and design decisions (why JSON Schema over TypeScript-only validation, why `additionalProperties: false`, why `number` for monetary amounts)
- Implemented the `BusinessRuleValidator` (`validators/business-rules.ts`): checks VAT category/rate consistency (S → 19%/7%, others → 0%), §13b reverse-charge buyer VAT ID requirement, BT-120/BT-121 exemption reason requirements, and EN 16931 rounding/amount consistency (line amounts, VAT breakdown totals, document totals, 2-decimal precision)
- Added 4 new fixtures covering reduced 7% VAT, VAT-exempt (E), zero-rated (Z), and reverse-charge (AE) scenarios, alongside the existing 19% fixtures
- Wrote business-rule validator tests with Vitest covering all 6 fixtures as valid cases plus one negative test per rule violation

**Doing** (22 Jun – 5 July)
- Expand schema: VAT block edge cases (§19, §13b), allowances/charges, additional payment terms
- Add multi-VAT-rate example invoice fixture
- Draft `ARCHITECTURE.md` explaining the adapter pattern and module boundaries

**Motivations & challenges**
- Motivation: having a runtime-validated schema as the single source of truth makes it safe to build the XML and PDF adapters in isolation — each adapter reads from a known-good object
- Challenge: TypeScript's strict NodeNext module resolution does not handle legacy CJS packages (AJV, ajv-formats) well; worked around by using named imports and `createRequire` in the test file

---

**Done** (1 Jun – 7 Jun)
- Initialized public repo: skeleton directories (`/core`, `/adapters`, `/validators`, `/fixtures`, `/docs`), TypeScript + ESLint + Prettier + Vitest toolchain
- Defined core invoice types (`Invoice`, `InvoiceLine`, `Party`, `VatBreakdown`) and mapped them to XRechnung Business Terms. (example. BT-1 Invoice number, BT-2 Invoice issue data ...)

**Doing** (8 Jun – 21 Jun)
- Draft internal invoice schema v0.1 as JSON Schema (mandatory XRechnung fields)
- Add 2 example invoice JSON fixtures + schema validation test
- Expand schema: VAT block, payment terms, allowances/charges

**Motivations & challenges**
- Motivation: clean architectural foundation makes Phase 2 XML work straightforward
- Challenge: balancing schema completeness now vs. keeping it minimal until XML mapping begins
