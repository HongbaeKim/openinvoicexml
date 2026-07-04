# Updates

Updated every two weeks. Most recent entry first.

---

**Done** (Jun 22 – July 5)
- Wrote `docs/ARCHITECTURE.md` and `docs/CONTRIBUTING.md`: adapter pattern, module boundaries, and the contributor workflow
- Added `CHANGELOG.md` and tagged release `v0.1.0`
- Implemented the XRechnung UBL 2.1 XML adapter (`adapters/xrechnung.ts`): maps document header, seller/buyer parties, payment means, VAT totals, and invoice lines to XRechnung 3.x elements, with XML-escaping and 2-decimal amount formatting
- Wrote `adapters/xrechnung.test.ts`: structural smoke tests across all 6 fixtures, field-mapping tests, and an XML-escaping test (14 tests)
- Wired `adapters/index.ts` to export `toXRechnung`
- Documented the BT → internal field → UBL element mapping in `docs/MAPPING.md`
- Added `Makefile` `generate` and `validate-xml` targets: generate XML for all 6 fixtures into `dist/xml/` and check well-formedness
- Full suite green: 68 tests passing across schema validation, business rules, and the XRechnung adapter

**Doing** (July 6 – July 19)
- Integrate the KoSIT validator (`validationtool`) as an automated validation step, run all XML fixtures through it, and fix structural validation errors
- Document KoSIT setup (Java version, scenario download, local run instructions) in the README developer section
- Implement structured VAT rule enforcement (category/rate consistency, reverse-charge buyer VAT ID, EN 16931 rounding tolerance) with automated test cases

**Motivations & challenges**
- Motivation: building the XML adapter only after the schema/validators were stable let it trust a fully-validated `Invoice` object, keeping the zero-runtime-dependency, template-string approach auditable
- Challenge: UBL 2.1's strict element ordering (e.g. `TaxExemptionReasonCode` before `TaxExemptionReason`, `Item/Description` before `Item/Name`) meant early XML drafts were schema-invalid despite correct data — required careful sequencing ahead of Week 6's KoSIT validation
- Challenge: settling where generated docs (`CHANGELOG.md`) should live took a few false starts — moved to `docs/` and back to the repo root before landing on root-level, matching where `README.md` and `LICENSE` already live

---

**Done** (Jun 8 – Jun 21)
- Drafted internal invoice schema v0.1 as a JSON Schema Draft-07 document (`schemas/invoice.schema.json`), covering all mandatory XRechnung Business Terms (BT-1 through BT-115) with field-level descriptions linking each field to its EU/German legal basis
- Added 2 example invoice JSON fixtures: a simple single-line domestic invoice and a multi-line invoice with a purchase order reference — both validate against the schema
- Wrote 33 schema validation tests with Vitest + AJV v8: 2 valid-fixture tests and 31 rejection tests covering missing required fields, wrong formats, invalid enumerations, extra properties, and multi-line-specific edge cases; all pass in CI
- Added `docs/SCHEMA.md` documenting field naming conventions, the full BT mapping table, VAT category codes, and design decisions (why JSON Schema over TypeScript-only validation, why `additionalProperties: false`, why `number` for monetary amounts)
- Implemented the `BusinessRuleValidator` (`validators/business-rules.ts`): checks VAT category/rate consistency (S → 19%/7%, others → 0%), §13b reverse-charge buyer VAT ID requirement, BT-120/BT-121 exemption reason requirements, and EN 16931 rounding/amount consistency (line amounts, VAT breakdown totals, document totals, 2-decimal precision)
- Added 4 new fixtures covering reduced 7% VAT, VAT-exempt (E), zero-rated (Z), and reverse-charge (AE) scenarios, alongside the existing 19% fixtures
- Wrote business-rule validator tests with Vitest covering all 6 fixtures as valid cases plus one negative test per rule violation

**Doing** *(Jun 22 – July 5)* 
- Expand schema: VAT block edge cases (§19, §13b), allowances/charges, additional payment terms
- Add multi-VAT-rate example invoice fixture
- Draft `ARCHITECTURE.md` explaining the adapter pattern and module boundaries

**Motivations & challenges**
- Motivation: having a runtime-validated schema as the single source of truth makes it safe to build the XML and PDF adapters in isolation — each adapter reads from a known-good object
- Challenge: TypeScript's strict NodeNext module resolution does not handle legacy CJS packages (AJV, ajv-formats) well; worked around by using named imports and `createRequire` in the test file

---

**Done** (Jun 1 – Jun 7)
- Initialized public repo: skeleton directories (`/core`, `/adapters`, `/validators`, `/fixtures`, `/docs`), TypeScript + ESLint + Prettier + Vitest toolchain
- Defined core invoice types (`Invoice`, `InvoiceLine`, `Party`, `VatBreakdown`) and mapped them to XRechnung Business Terms. (example. BT-1 Invoice number, BT-2 Invoice issue data ...)

**Doing** (Jun 8 – Jun 21)
- Draft internal invoice schema v0.1 as JSON Schema (mandatory XRechnung fields)
- Add 2 example invoice JSON fixtures + schema validation test
- Expand schema: VAT block, payment terms, allowances/charges

**Motivations & challenges**
- Motivation: clean architectural foundation makes Phase 2 XML work straightforward
- Challenge: balancing schema completeness now vs. keeping it minimal until XML mapping begins
