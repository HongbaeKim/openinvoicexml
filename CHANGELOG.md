# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.4.2] - 2026-10-03

### Added

- `Party.identifier` (BT-29 seller / BT-46 buyer, optional `schemeId`; BT-46 is optional and not part of BR-CO-26): schema, UBL
  (`cac:PartyIdentification`) and CII (`ram:ID`, or `ram:GlobalID` with a scheme) output.
- `validateBusinessRules()` checks BR-CO-26 (`SELLER_IDENTIFIER_REQUIRED`): the seller needs
  `identifier`, `legalId` or `vatId`. `taxRegistrationId` alone, a SEPA-scheme identifier or a
  whitespace-only value does not count.
- Fixtures 55 and 56 (freelancer without VAT ID, with a BT-29 seller identifier). Both pass KoSIT
  (UBL and both CII profiles) and Mustang (extracted UBL XML and both Factur-X profiles) with zero
  errors, which confirms the FeRD E13 convention (Steuernummer as both BT-32 and BT-29) is accepted.

### Changed

- **Behavior change:** invoices whose seller has none of BT-29/BT-30/BT-31 now fail
  `validateBusinessRules()` locally (previously only KoSIT/Mustang rejected them). The engine
  never copies the Steuernummer into BT-29 on its own. In particular, a seller with only a
  Steuernummer (`taxRegistrationId`, BT-32) now fails with `SELLER_IDENTIFIER_REQUIRED`; set
  `identifier` (BT-29), `legalId` or `vatId`. Using the Steuernummer as BT-29 is an accepted
  convention (FeRD E13), not a requirement.

## [0.4.1] - 2026-10-03

### Added

- `openinvoicexml/browser` entry point with `generateInvoiceXml()`: browser-safe XRechnung XML
  generation, no Node.js dependencies; `generateInvoiceXml()` is also exported from
  `openinvoicexml/adapters` (same function)
- `validateXmlExternally()`: checks XML with KoSIT and Mustang, reporting each validator
  separately (Node-only)
- `validateFileExternally()` / `detectInvoiceFormat()`: validate an existing XML or hybrid/
  Factur-X PDF invoice file with KoSIT, Mustang and veraPDF (Node-only)
- `runKosit()` reports the matched scenario; `runVeraPdf()` reports the applied profile and can
  auto-detect the PDF/A flavour
- CI validates the browser entry's exact output with KoSIT and Mustang
- `roundingAmount` (BT-114): optional, explicit payable adjustment (never applied automatically), written as `cbc:PayableRoundingAmount` (UBL)
  / `ram:RoundingAmount` (CII) and shown on the PDF; `duePayableAmount` is checked against
  `taxInclusiveAmount − prepaidAmount + roundingAmount` (BR-CO-16)
- Fixtures 51–54: high-precision unit price, rounding amount, fractional quantity, and both
  combined
- `validateInvoiceSchema()`: JSON Schema (structure) validation, returning the same issue shape as
  the business-rule validators
- Warning `ISSUE_DATE_IN_FUTURE` when the issue date (BT-2) is later than today (legal, but
  usually a typo)

### Changed

- Every `generate*()` function now validates the invoice's structure first; a malformed invoice
  returns `{ xml: null, issues }` (or the equivalent) instead of throwing a `TypeError`
- The JSON Schema now caps free-text and identifier fields with `maxLength` (500 characters for
  identifiers and references, 10000 for notes and long text)
- `ajv` and `ajv-formats` moved from `devDependencies` to `dependencies`; `dist/schemas` is now
  included in the published package

### Fixed

- `toXRechnung()` and `toCii()` now escape every interpolated value, including country, VAT
  category and type codes, dates and `currencyID` attributes, so XML metacharacters in them can no
  longer break the XML
- `generateInvoice({ validateExternally: true })` no longer leaves KoSIT reports in the temp dir
- `runMustang()` reports Mustang's `<exception>` entries as errors
- Unit prices (BT-146) with more than 2 decimals (e.g. `0.0055`) are no longer rejected, and are
  written to the XML and PDF unrounded instead of rounded to 2 decimals

## [0.4.0] - 2026-09-17

### Added

- Hybrid PDF/A-3b export (`toHybridPdf()`), veraPDF-validated
- CII XML adapter (`toCii()`) and genuine Factur-X/ZUGFeRD hybrid PDF (`toFacturXPdf()`) for the
  `EN16931`/`XRECHNUNG` profiles, cross-validated against KoSIT, veraPDF, and Mustang
- `generateInvoiceDocument(invoice, { format })`: one entry point for all four output formats
- Unified `ComplianceIssue` diagnostics across business-rules/KoSIT/veraPDF/Mustang, with
  suggested fixes for first-party rules; opt-in via `generateInvoice(invoice, { validateExternally: true })`
- BT-10 (buyer reference) enforced as mandatory under XRechnung
- Fixture library grown from 30 to 41, all validated with zero errors

### Fixed

- PDF line-item pagination across multiple pages; payment-info block rendering

### Profile compatibility

| Profile                    | Supported                                                      |
| -------------------------- | -------------------------------------------------------------- |
| XRECHNUNG                  | Yes                                                            |
| EN 16931                   | Yes                                                            |
| BASIC WL / BASIC / MINIMUM | No — partial-data profiles, tracked in `.step/longtermplan.md` |

See [`LIMITATIONS.md`](docs/LIMITATIONS.md) for detail.

### Supported XRechnung Business Terms

Only BT-11 (project reference), BT-17 (tender/lot reference), and BG-24 (additional supporting
documents) remain unmapped — see [`DATA-MODEL.md`](docs/DATA-MODEL.md) for the full table and
[`fixtures/README.md`](fixtures/README.md) for the complete fixture index.

## [0.3.0] - 2026-08-24

### Added

- Allowances and charges (BG-20/21 document-level, BG-27/28 line-level), with corrected line/
  document-total rounding formulas
- BT-12, BT-13, BT-25/BT-26, BT-113 in XRechnung XML
- §13b reverse-charge subcases (construction, scrap metal, security, cleaning, mobile devices,
  gas/electricity, intra-EU services, real estate, telecommunications), intra-EU supply, export,
  §19 small business, and outside-scope (category O) VAT rules
- Credit notes and corrective invoices, rendered as proper UBL document types
- Fixture library grown from 6 to 30, each validated via KoSIT with zero errors

### Supported XRechnung Business Terms

Only BT-11 (project reference), BT-17 (tender/lot reference), and BG-24 (additional supporting
documents) remain unmapped — see [`DATA-MODEL.md`](docs/DATA-MODEL.md) for the full table and
[`fixtures/README.md`](fixtures/README.md) for the complete fixture index.

## [0.2.0] - 2026-07-20

### Added

- XRechnung UBL 2.1 XML generation (`toXRechnung`) validated locally via the official KoSIT
  validator (`runKosit`) — zero error-severity findings across all 6 current fixtures
- Structured VAT rule enforcement (`validateBusinessRules`): VAT category/rate consistency
  (category `S` restricted to Germany's 19%/7% standard/reduced rates), [§13b][ustg-13b] UStG reverse-charge
  buyer-VAT-ID requirement, exemption-reason requirements, and EN 16931 rounding/decimal-precision
  rules across line items, VAT breakdowns, and document-level totals
- `generateInvoice()` pipeline composing business-rule validation with XML generation — returns
  `{ xml: null, issues }` instead of producing XML for any invoice with an error-severity issue
- `docs/API.md`: usage reference for `generateInvoice`, `toXRechnung`, the `ValidationIssue`
  error-code contract, and `runKosit`
- CI (`.github/workflows/ci.yml`): `lint` + `typecheck` + `test` (including the full KoSIT-backed
  fixture regression) on every push/PR to `main`

### Changed

- `adapters/xrechnung.ts` refactored into a field-mapping step (`adapters/xrechnung-mapping.ts`,
  independently tested) and a serialization step, so BT-to-field resolution and UBL markup
  generation can be reasoned about and tested separately. Output is unchanged — verified
  byte-identical against the pre-refactor XML for all 6 fixtures.

### Supported XRechnung Business Terms

See [`DATA-MODEL.md`](docs/DATA-MODEL.md) for the full BT ↔ internal-field ↔ UBL-element table. In
summary: all core document-level (BG-2), seller/buyer (BG-4/BG-7), VAT breakdown (BG-23),
document totals (BG-22), payment means (BG-16), and invoice line (BG-25) terms are mapped and
emitted. The following are explicitly **deferred to Phase 3** (`docs/DATA-MODEL.md`'s "Not yet
mapped" section):

- BT-11 (project reference), BT-12 (contract reference), BT-13 (purchase order reference),
  BT-17 (tender/lot reference)
- BT-25 / BT-26 (preceding invoice reference — needed for credit notes/corrections)
- BG-24 (additional supporting documents)
- BG-20 / BG-21 (document-level allowances/charges), BG-27 / BG-28 (line-level allowances/charges)
- BT-113 (prepaid amount)

Legal scenarios beyond the current 6 fixtures ([§19][ustg-19] small business, [§13b][ustg-13b] subcases beyond the
single reverse-charge check above, intra-EU supply, export, credit notes, down payments) remain
Phase 3 scope — see [`LIMITATIONS.md`](docs/LIMITATIONS.md).

## [0.1.0] - 2026-06-28

### Added

- Core invoice schema and internal `Invoice` type
- JSON Schema validation via AJV (zero runtime dependencies)
- Business rule validators for XRechnung compliance
- XRechnung XML adapter
- Fixture suite covering standard invoice categories
- Architecture, Contributing, and Limitations documentation

[ustg-13b]: https://www.gesetze-im-internet.de/ustg_1980/__13b.html
[ustg-19]: https://www.gesetze-im-internet.de/ustg_1980/__19.html
