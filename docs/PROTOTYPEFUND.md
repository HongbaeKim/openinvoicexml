# Updates

Updated every two weeks. Most recent entry first.

---

## Jun 8 – Jun 21, 2026
**Done**
- Drafted internal invoice schema v0.1 as a JSON Schema Draft-07 document (`schemas/invoice.schema.json`), covering all mandatory XRechnung Business Terms (BT-1 through BT-115) with field-level descriptions linking each field to its EU/German legal basis
- Added 2 example invoice JSON fixtures: a simple single-line domestic invoice and a multi-line invoice with a purchase order reference — both validate against the schema
- Wrote 33 schema validation tests with Vitest + AJV v8: 2 valid-fixture tests and 31 rejection tests covering missing required fields, wrong formats, invalid enumerations, extra properties, and multi-line-specific edge cases; all pass in CI
- Added `docs/SCHEMA.md` documenting field naming conventions, the full BT mapping table, VAT category codes, and design decisions (why JSON Schema over TypeScript-only validation, why `additionalProperties: false`, why `number` for monetary amounts)
- Implemented the `BusinessRuleValidator` (`validators/business-rules.ts`): checks VAT category/rate consistency (S → 19%/7%, others → 0%), §13b reverse-charge buyer VAT ID requirement, BT-120/BT-121 exemption reason requirements, and EN 16931 rounding/amount consistency (line amounts, VAT breakdown totals, document totals, 2-decimal precision)
- Added 4 new fixtures covering reduced 7% VAT, VAT-exempt (E), zero-rated (Z), and reverse-charge (AE) scenarios, alongside the existing 19% fixtures
- Wrote business-rule validator tests with Vitest covering all 6 fixtures as valid cases plus one negative test per rule violation

**Doing** *(Jun 22 – July 6)* 
- Expand schema: VAT block edge cases (§19, §13b), allowances/charges, additional payment terms
- Add multi-VAT-rate example invoice fixture
- Draft `ARCHITECTURE.md` explaining the adapter pattern and module boundaries

**Motivations & challenges**
- Motivation: having a runtime-validated schema as the single source of truth makes it safe to build the XML and PDF adapters in isolation — each adapter reads from a known-good object
- Challenge: TypeScript's strict NodeNext module resolution does not handle legacy CJS packages (AJV, ajv-formats) well; worked around by using named imports and `createRequire` in the test file

---

## Jun 1 – Jun 7, 2026
**Done**
- Initialized public repo: skeleton directories (`/core`, `/adapters`, `/validators`, `/fixtures`, `/docs`), TypeScript + ESLint + Prettier + Vitest toolchain
- Defined core invoice types (`Invoice`, `InvoiceLine`, `Party`, `VatBreakdown`) and mapped them to XRechnung Business Terms. (example. BT-1 Invoice number, BT-2 Invoice issue data ...)

**Doing** *(Jun 8 – Jun 21)* 
- Draft internal invoice schema v0.1 as JSON Schema (mandatory XRechnung fields)
- Add 2 example invoice JSON fixtures + schema validation test
- Expand schema: VAT block, payment terms, allowances/charges

**Motivations & challenges**
- Motivation: clean architectural foundation makes Phase 2 XML work straightforward
- Challenge: balancing schema completeness now vs. keeping it minimal until XML mapping begins
