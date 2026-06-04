# Updates

Updated every two weeks. Most recent entry first.

---

## Jun 1 – Jun 7, 2026
8 hours
**Done**
- Initialized public repo: skeleton directories (`/core`, `/adapters`, `/validators`, `/fixtures`, `/docs`), TypeScript + ESLint + Prettier + Vitest toolchain
- Defined core invoice types (`Invoice`, `InvoiceLine`, `Party`, `VatBreakdown`) and mapped them to XRechnung Business Terms. (example. BT-1 Invoice number, BT-2 Invoice issue data ...)

**Doing** *(Jun 8 – Jun 21)* 16 hours
- Draft internal invoice schema v0.1 as JSON Schema (mandatory XRechnung fields)
- Add 2 example invoice JSON fixtures + schema validation test
- Expand schema: VAT block, payment terms, allowances/charges

**Motivations & challenges**
- Motivation: clean architectural foundation makes Phase 2 XML work straightforward
- Challenge: balancing schema completeness now vs. keeping it minimal until XML mapping begins
