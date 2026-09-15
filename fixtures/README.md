# Fixtures

JSON invoice examples used for development, testing, and documentation.

Each fixture is a valid `Invoice` object (see `core/types/invoice.ts`) and has a corresponding
expected XRechnung XML output once Phase 2 is complete.

| File                               | Scenario                                 | Status      |
| ---------------------------------- | ---------------------------------------- | ----------- |
| `01.domestic-simple.invoice.json`     | Standard 19% VAT                         | Implemented |
| `02.domestic-multi-line.invoice.json` | Multiple lines, standard VAT, purchase order reference | Implemented |
| `03.reduced-rate.invoice.json`        | Reduced 7% VAT (category S)              | Implemented |
| `04.exempt.invoice.json`              | VAT-exempt (category E, §4 UStG)         | Implemented |
| `05.zero-rated.invoice.json`          | Zero-rated (category Z)                  | Implemented |
| `06.reverse-charge.invoice.json`      | Reverse charge / §13b UStG (category AE) | Implemented |
| `07.small-business.invoice.json`      | §19 UStG small business (category E)     | Implemented |
| `08.intra-eu-supply.invoice.json`     | Intra-EU supply (category K)             | Implemented |
| `09.export.invoice.json`              | Export outside EU (category G)           | Implemented |
| `10.reverse-charge-construction.invoice.json` | §13b subcase: construction (category AE) | Implemented |
| `11.reverse-charge-scrap-metal.invoice.json`  | §13b subcase: scrap metal (category AE)  | Implemented |
| `12.reverse-charge-security-transfer.invoice.json` | §13b subcase: security transfer (category AE) | Implemented |
| `13.reverse-charge-cleaning.invoice.json`     | §13b subcase: building cleaning (category AE) | Implemented |
| `14.reverse-charge-mobile-devices.invoice.json` | §13b subcase: mobile devices (category AE) | Implemented |
| `15.reverse-charge-gas-and-electricity.invoice.json` | §13b subcase: gas/electricity (category AE) | Implemented |
| `16.credit-note-full.invoice.json`    | Credit note (typeCode 381), full reversal          | Implemented |
| `17.credit-note-partial.invoice.json` | Credit note (typeCode 381), partial line-item credit | Implemented |
| `18.corrective-invoice.invoice.json`  | Corrective invoice (typeCode 384), partial line-item correction | Implemented |
| `19.down-payment.invoice.json`        | Down payment invoice (Anzahlungsrechnung)          | Implemented |
| `20.final-invoice.invoice.json`       | Final invoice (Schlussrechnung) deducting a down payment | Implemented |
| `21.partial-delivery.invoice.json`    | Partial delivery invoice (Teilrechnung) with contract reference | Implemented |
| `22.document-level-discount.invoice.json` | Document-level allowance (BG-20)         | Implemented |
| `23.line-level-discount.invoice.json` | Line-level allowance (BG-27)             | Implemented |
| `24.combined-line-and-document-discount.invoice.json` | Both a line-level and a document-level allowance together | Implemented |
| `25.document-level-surcharge.invoice.json` | Document-level charge (BG-21)          | Implemented |
| `26.line-level-surcharge.invoice.json` | Line-level charge (BG-28)               | Implemented |
| `27.reverse-charge-intra-eu-services.invoice.json` | §13b subcase: cross-border EU services (category AE) | Implemented |
| `28.multiple-vat-rates.invoice.json`  | Multiple VAT rates (19%/7%) on one invoice | Implemented |
| `29.reverse-charge-real-estate.invoice.json` | §13b subcase: real estate transfer (category AE) | Implemented |
| `30.reverse-charge-telecommunications.invoice.json` | §13b subcase: telecommunications (category AE) | Implemented |
| `31.many-lines.invoice.json`          | 55 line items, standard 19% VAT          | Implemented |
| `32.umlaut-name.invoice.json`         | Umlauts/ß in party names, long wrapped line description | Implemented |
| `33.minimal-required-fields.invoice.json` | Only required fields set (plus mandatory BT-10) | Implemented |
| `34.export-with-customs-reference.invoice.json` | Export outside EU (category G) with a customs/export declaration reference | Implemented |
| `35.corrective-invoice-multi-line.invoice.json` | Corrective invoice (typeCode 384), two omitted lines corrected together | Implemented |
| `36.reverse-charge-foreign-supplier.invoice.json` | §13b subcase: foreign (non-established) supplier (category AE) | Implemented |
| `37.reverse-charge-emission-certificates.invoice.json` | §13b subcase: emission certificates trading (category AE) | Implemented |
| `38.reverse-charge-qualifying-gold.invoice.json` | §13b subcase: qualifying/investment gold (category AE) | Implemented |
| `39.reverse-charge-industrial-metals.invoice.json` | §13b subcase: industrial metals, Anlage 4 (category AE) | Implemented |
| `40.document-mixed-allowance-and-charge.invoice.json` | Document-level allowance and charge combined in one invoice | Implemented |
| `41.outside-scope-damages.invoice.json` | Outside the scope of VAT (category O) — genuine damages compensation | Implemented |

Note: fixtures can't carry inline comments — they're loaded via `import ... with { type: "json" }` and
validated against `schemas/invoice.schema.json`, which sets `"additionalProperties": false` at every level,
so any extra `_comment`-style key would fail schema validation. Explanations live here instead.

## Notes

`01.domestic-simple.invoice.json` is the baseline most other fixtures are adapted from: one line item, category
`S` at 19%, no `exemptionReason`/`exemptionReasonCode` (full VAT applies, nothing to justify).

- **`02.domestic-multi-line.invoice.json`** — same baseline, but three line items (consulting, review, tools
  license) summed into one `vatBreakdowns` entry, to test line-aggregation rather than VAT-category logic.
  Also sets `purchaseOrderReference` (BT-13), to exercise `cac:OrderReference` alongside the multi-line case.
- **`03.reduced-rate.invoice.json`** — same shape as the baseline, but `vatRate: 7` / category `S` (reduced rate
  for books, per §12 Abs. 2 UStG ([ustg-12])), to test the reduced-rate math path.
- **`04.exempt.invoice.json`** — category `E`, `vatRate: 0`, with an `exemptionReason` ("Heilbehandlung", §4
  Nr. 14 UStG ([ustg-4])) and `exemptionReasonCode: "VATEX-EU-79-C"` ([en16931-artefacts]). Tests that
  category `E` requires a reason, unlike `S`.
- **`05.zero-rated.invoice.json`** — category `Z`, `vatRate: 0`, no `exemptionReason`/`exemptionReasonCode` —
  unlike `04.exempt.invoice.json`'s category `E`, `Z` doesn't require one.
- **`06.reverse-charge.invoice.json`** — category `AE`, `vatRate: 0`, generic §13b UStG ([ustg-13b]) `exemptionReason`
  ("Steuerschuldnerschaft des Leistungsempfängers gem. §13b UStG") and `exemptionReasonCode:
  "VATEX-EU-AE"`. No `reverseChargeReason` field — this predates the subcase feature and acts as the
  "no subcase declared" baseline in `validators/test/15.reverse-charge.test.ts`.
- **`10.reverse-charge-construction.invoice.json`**, **`11.reverse-charge-scrap-metal.invoice.json`**,
  **`12.reverse-charge-security-transfer.invoice.json`**, **`13.reverse-charge-cleaning.invoice.json`**,
  **`14.reverse-charge-mobile-devices.invoice.json`**, **`15.reverse-charge-gas-and-electricity.invoice.json`** —
  each sets `vatBreakdowns[].reverseChargeReason` to its subcase and matches the `exemptionReason` text to
  it, since `checkReverseChargeSubcaseRequirements` (`validators/rules/15.reverse-charge.ts`) requires the two
  to agree. Together with `construction`/`scrap-and-waste`, these six satisfy `ROADMAP.md` Week 9's "5+"
  subcase target (its "security services" item is modeled as `security-transfer` instead — §13b Abs. 2
  Nr. 2 actually covers goods transferred as collateral, not security services — see [ustg-13b]). Remaining 7 subcases:
  see `docs/LIMITATIONS.md`. `mobile-devices` is priced at €6,000 to satisfy the (unenforced) €5,000
  threshold, also documented there.
- **`07.small-business.invoice.json`** — category `E`, no `vatId` on the seller (only `taxRegistrationId`), and
  `exemptionReason: "Gemäß § 19 UStG..."` ([ustg-19], Kleinunternehmer/small-business exemption, not a general §4
  exemption). Tests that a seller can be VAT-registered without an EU VAT ID.
- **`08.intra-eu-supply.invoice.json`** — category `K`, buyer is in France (`FR` VAT ID/address) instead of
  Germany, plus a `delivery` block with `deliverTo` in another EU country. Tests cross-border EU delivery
  and the `§6a UStG` ([ustg-6a]) intra-Community exemption wording/code (`VATEX-EU-IC`, [en16931-artefacts]).
- **`09.export.invoice.json`** — category `G`, buyer is in Switzerland (`CH`, non-EU, no `vatId`), plus a
  `delivery` block with `deliverTo` outside the EU. Tests the outside-EU export exemption
  (`§4 Nr. 1 Buchst. a UStG` ([ustg-4]), `VATEX-EU-G` [en16931-artefacts]), distinct from
  `08.intra-eu-supply.invoice.json`'s within-EU case.
- **`16.credit-note-full.invoice.json`** — typeCode `381`, full reversal of `01.domestic-simple.invoice.json`
  (`RE-2026-0042`): negated quantity/lineAmount/VAT breakdown/totals, `precedingInvoiceReference` pointing
  back at the original invoice's id/issueDate. Tests `CREDIT_NOTE_POSITIVE_AMOUNT` and
  `PRECEDING_INVOICE_REFERENCE_REQUIRED` (`validators/rules/10.credit-note.ts`) on the fully-negative case.
- **`17.credit-note-partial.invoice.json`** — typeCode `381`, partial credit against
  `02.domestic-multi-line.invoice.json` (`RE-2026-0043`): only 2 of the original 3 lines are credited
  (negated), the third (consulting) stays untouched on the original invoice. Tests that VAT breakdown
  arithmetic checks work correctly against a subset of lines, not just a full reversal.
- **`18.corrective-invoice.invoice.json`** — typeCode `384`, models a seller who already sent invoice
  `RE-2026-0044` (2026-06-12) but forgot to bill 3 consulting hours, so they issue a *new* document,
  `RE-2026-0045`, that only bills the missing hours (`precedingInvoiceReference` points back at
  `RE-2026-0044`). Unlike `16`/`17`'s credit notes, a corrective invoice adds to what's owed rather
  than reducing it, so `duePayableAmount` is positive (`446.25`) — `CREDIT_NOTE_POSITIVE_AMOUNT`
  doesn't apply here since that check is `381`-only, but `PRECEDING_INVOICE_REFERENCE_REQUIRED` still
  does, since both `381` and `384` must say what they reference (`validators/rules/10.credit-note.ts`).
  As with `17`, only the amended line is present, not a full copy of the original invoice — that's a
  fixture-authoring convention, not something the schema enforces, since the internal `Invoice` type
  has no concept of "the original document" to diff against.
- **`19.down-payment.invoice.json`** — typeCode `380`, an Anzahlungsrechnung billing 30% of a
  EUR 20,000 net project (`RE-2026-0050`, EUR 6,000 net / EUR 7,140 gross) up front. A down payment
  invoice needs no engine changes over a normal invoice — it's just a `380` for a partial amount,
  with its own VAT breakdown at the time of payment.
- **`20.final-invoice.invoice.json`** — typeCode `380`, the Schlussrechnung for the same project
  (`RE-2026-0055`): bills the full EUR 20,000 net contract value, sets `prepaidAmount: 7140.00`
  (BT-113, the down payment's gross total) and `precedingInvoiceReference` pointing back at
  `19.down-payment.invoice.json`'s id/issueDate, so `duePayableAmount` correctly nets down to
  `16660.00` (`taxInclusiveAmount − prepaidAmount`, BT-115 = BT-112 − BT-113 — see [en16931] for the
  BT field definitions and rule text). Tests `INVOICE_DUE_PAYABLE_AMOUNT_MISMATCH` and
  `PRECEDING_INVOICE_REFERENCE_REQUIRED` (`validators/02.business-rules.ts`) together in a realistic
  scenario, not just isolated mutations.
- **`21.partial-delivery.invoice.json`** — typeCode `380`, a Teilrechnung (`RE-2026-0060`) billing
  Phase 1 of a 3-phase EUR 50,000 net framework contract. Sets `contractReference` (BT-12,
  `VERTRAG-2026-0200`) and states the overall contract value and remaining balance in free-text
  `note` (BT-22) rather than a dedicated schema field — EN 16931/XRechnung ([en16931]) has no BT for
  either, so inventing one would be unvalidatable by KoSIT and unrecognized by any receiving system
  (see `docs/LIMITATIONS.md`).
- **`22.document-level-discount.invoice.json`** — typeCode `380`, a EUR 1000 net line (8 HUR ×
  EUR 125) with a EUR 100 document-level allowance (BG-20, `Sammelrabatt`, category `S`/19%),
  bringing `taxExclusiveAmount` to EUR 900. Proves `taxExclusiveAmount = BT-106 − BT-107` (see
  `docs/DATA-MODEL.md`'s "Document totals" section) when the allowance sits at document level
  rather than on the line.
- **`23.line-level-discount.invoice.json`** — the same scenario as `22`, but the EUR 100 allowance
  (`Treuerabatt`) is attached to the line itself (BG-27) instead of the document, so
  `lines[0].lineAmount` is already net (EUR 900) and there's no top-level `allowancesCharges` at
  all. Same final totals as `22` (`taxExclusiveAmount` EUR 900), proving both paths reach the same
  math.
- **`24.combined-line-and-document-discount.invoice.json`** — combines `22` and `23`: the line has
  its own EUR 100 allowance (`Treuerabatt`, BG-27) bringing `lineAmount` to EUR 900, *and* the
  document has a separate EUR 50 allowance (`Sammelrabatt`, BG-20, category `S`/19%) applied on
  top, bringing `taxExclusiveAmount` to EUR 850. Exists specifically to prove the two allowance
  levels compose additively (`BT-109 = BT-106 − BT-107`, with `BT-106` already net of the line's
  own allowance) rather than one masking or double-subtracting the other.
- **`25.document-level-surcharge.invoice.json`** — mirrors `22`, but the EUR 50 document-level
  adjustment (`Expresszuschlag`, BG-21, category `S`/19%) is a charge (`isCharge: true`) rather
  than an allowance, bringing `taxExclusiveAmount` *up* to EUR 1050 instead of down.
- **`26.line-level-surcharge.invoice.json`** — mirrors `23`, but the EUR 50 line-level adjustment
  (`Eilzuschlag`, BG-28) is a charge, so `lines[0].lineAmount` is EUR 1050 (quantity × unitPrice
  plus the charge) rather than net of a discount.
- **`27.reverse-charge-intra-eu-services.invoice.json`** — category `AE`, buyer in Austria
  (`AT` VAT ID/address), a cross-border B2B consulting service taxable in Germany under §3a Abs. 2
  UStG. Tests the `eu-cross-border-service` §13b Abs. 1 UStG subcase
  (`checkReverseChargeSubcaseRequirements`, `validators/rules/15.reverse-charge.ts`) — distinct
  from both the domestic §13b Abs. 2 subcases (`10`–`15`, `29`, `30`) and `08`'s category `K`
  intra-EU goods supply, since this is a cross-border *service* reverse-charged to a German-taxable
  transaction rather than a tax-free intra-Community goods delivery.
- **`28.multiple-vat-rates.invoice.json`** — one invoice, two lines split across `S`/19%
  (consulting) and `S`/7% (technical books, reduced rate per §12 Abs. 2 UStG), each in its own
  `vatBreakdowns` entry. Tests that `VAT_TAXABLE_AMOUNT_MISMATCH` and the line-aggregation checks
  (`validators/02.business-rules.ts`) work correctly per category/rate pair on the same document,
  not just across single-rate fixtures.
- **`29.reverse-charge-real-estate.invoice.json`** — category `AE`, sale of a commercial property
  where the seller has opted into VAT liability under §9 UStG, making the transaction subject to
  reverse charge under §13b Abs. 2 Nr. 3 UStG. Tests the `real-estate` subcase, one of the 7
  §13b Abs. 2 subcases previously modeled in code but unfixtured (`docs/LIMITATIONS.md`).
- **`30.reverse-charge-telecommunications.invoice.json`** — category `AE`, wholesale
  telecommunications services sold to a reseller, reverse-charged under §13b Abs. 2 Nr. 12 UStG.
  Tests the `telecommunications` subcase, closing another of the previously-unfixtured 7.
- **`31.many-lines.invoice.json`** — `ROADMAP.md` Week 16 Task 1's "50+ line items" edge case:
  55 daily-consulting line items (`RE-2026-0070`), all category `S`/19%, so the fixture stresses
  the hybrid PDF table's pagination rather than any VAT-category logic. Regression-tested in
  `adapters/hybrid-pdf.test.ts` ("50+ line items (pagination)") to confirm the generated PDF
  actually spans multiple pages (with the table header repeated on each) instead of silently
  overflowing past the page margin — see `adapters/hybrid-pdf.ts`'s `ensureSpace()`/`drawLineRow()`
  fix for the bug this fixture caught: a hardcoded per-row space estimate that didn't account for
  wrapped multi-line rows.
- **`32.umlaut-name.invoice.json`** — Week 16 Task 1's "font glyph coverage" and "long
  descriptions" edge cases together: seller and buyer names containing `ä ö ü ß` (`Härtel Öztürk
  Straßmann GmbH` / `Grünwald Straßenbau Gebäudetechnik AG`), and a line-item description long
  enough to wrap across several lines in the PDF table cell. `adapters/hybrid-pdf.test.ts` checks
  the embedded DejaVuSans font has real glyphs (not `.notdef`) for every umlaut/`ß` character and
  that the long description wraps to multiple lines rather than being truncated; actually opening
  the rendered PDF and eyeballing the glyphs is still a manual step — embedded fonts are subset
  and CID-encoded, so rendered text isn't recoverable as plain strings from the saved PDF bytes
  for an automated assertion.
- **`33.minimal-required-fields.invoice.json`** — Week 16 Task 1's "empty optional fields" edge
  case: sets none of `note`, `contractReference`, `purchaseOrderReference`,
  `precedingInvoiceReference`, `prepaidAmount`, line `description`, or `allowancesCharges`.
  `.step/16.md`'s original plan also listed `buyerReference`, `dueDate`, and `paymentMeans` as
  safe to leave empty, but `make validate-hybrid` (real KoSIT, not this project's own TS
  validator) rejected that version of the fixture with two errors: BR-DE-1 (XRechnung requires
  BG-16 payment means outright) and BR-CO-25 (BT-9 due date or BT-20 payment terms is required
  whenever the amount due is positive — this engine has no BT-20 field, so BT-9 is the only way
  to satisfy it, on top of BT-10 buyer reference already being XRechnung-mandatory). Neither rule
  is checked by `validateBusinessRules()` yet, so this fixture (and
  `adapters/xrechnung.test.ts`'s "empty optional fields" describe block) is the regression guard
  until they are — see `docs/LIMITATIONS.md`. `adapters/hybrid-pdf.ts`'s `drawPaymentInfo()` was
  separately fixed to skip the "Zahlungsinformationen" block entirely when `paymentMeans` is
  absent, rather than printing a header with only a bank-detail-less `Verwendungszweck` row; this
  fixture's own `paymentMeans` only sets `code`/`iban` (no `accountName`/`bic`) to also exercise
  that block's own optional sub-fields.
- **`34.export-with-customs-reference.invoice.json`** — Week 16 Task 2's "export with customs
  reference" scenario: same category `G` export-outside-EU mechanism as `09.export.invoice.json`,
  but to a US buyer instead of a Swiss one, and with an export customs declaration reference (an
  ATLAS MRN) stated in free-text `note` (BT-22). There's no dedicated field for it — EN 16931/
  XRechnung has no BT for a customs reference — see `docs/LIMITATIONS.md`.
- **`35.corrective-invoice-multi-line.invoice.json`** — Week 16 Task 2's multi-line corrective
  invoice, distinct from `18.corrective-invoice.invoice.json`'s single omitted line: two separate
  line items (project management hours, travel expenses) that were both left off the original
  invoice are billed together in one correction (typeCode `384`).
- **`36.reverse-charge-foreign-supplier.invoice.json`**, **`37.reverse-charge-emission-certificates.invoice.json`**,
  **`38.reverse-charge-qualifying-gold.invoice.json`**, **`39.reverse-charge-industrial-metals.invoice.json`** —
  close 4 of the 4 remaining previously-unfixtured §13b Abs. 2 subcases noted in
  `docs/LIMITATIONS.md` (`foreign-supplier`, `emission-certificates`, `qualifying-gold`,
  `industrial-metals`). `foreign-supplier` is also the first fixture with a non-German seller
  (Austria) — the reverse-charge liability here shifts to the German buyer specifically because
  the supplier is established abroad. `industrial-metals` follows the same €5,000+ net-amount
  convention `14.reverse-charge-mobile-devices.invoice.json` established for the (also unverified)
  statutory threshold.
- **`40.document-mixed-allowance-and-charge.invoice.json`** — a document-level allowance
  (`Treuerabatt`) and a document-level charge (`Expresszuschlag`) in the same `allowancesCharges`
  array on one invoice, proving the mixed-sign case: `VAT_TAXABLE_AMOUNT_MISMATCH`'s
  `netAllowanceChargeAdjustment` (`validators/02.business-rules.ts`) sums allowances and charges
  together correctly (`1000 − 100 + 40 = 940`) rather than only being exercised with same-sign
  entries, as every other allowance/charge fixture (`22`–`26`) is.
- **`41.outside-scope-damages.invoice.json`** — the first fixture for VAT category `O` ("not
  subject to VAT"), for which `checkOutsideScopeRequirements` (`validators/rules/14.outside-scope.ts`)
  existed with unit-test coverage but no end-to-end fixture. Models genuine damages compensation
  (no goods/service/right/tolerance given in return, so outside the VAT system entirely per §1
  Abs. 1 UStG — not the same as an `E`-category exemption). Per `BR-O-02`, neither party may carry
  a VAT identifier (BT-31/BT-48) on an `O`-category invoice, so the seller here drops `vatId` in
  favor of `legalId` (BT-30, Handelsregisternummer) instead — real KoSIT's `BR-CO-26` independently
  requires at least one seller identifier (BT-29/BT-30/BT-31), which `taxRegistrationId` (BT-32,
  a different element) doesn't satisfy on its own.

## References

The scenarios and field references above are grounded in these sources, not a live dataset:

| Source                                              | Link                  | Notes                                                                 |
| ---------------------------------------------------- | --------------------- | ---------------------------------------------------------------------- |
| EN 16931 validation rules (GitHub)                  | [en16931]              | BT-xx field definitions and BR-xx rule text (e.g. `BT-113`, `BR-S-05`) |
| EN 16931 supporting-artefacts & code-list registry  | [en16931-artefacts]    | VATEX exemption reason codes                                          |
| German invoice-content law, §4 UStG                 | [ustg-4]               | VAT exemptions (category `E`, non-§19)                                 |
| German tax rates, §12 UStG                          | [ustg-12]              | 19%/7%/0% rate categories                                              |
| German reverse-charge law, §13b UStG                | [ustg-13b]             | `AE` category and its subcases                                        |
| German small-business law, §19 UStG                 | [ustg-19]              | Kleinunternehmerregelung exemption                                     |
| German intra-community supply law, §6a UStG         | [ustg-6a]              | `K` category (intra-EU supply)                                        |

[en16931]: https://github.com/ConnectingEurope/eInvoicing-EN16931
[en16931-artefacts]: https://ec.europa.eu/digital-building-blocks/sites/display/DIGITAL/Registry+of+supporting+artefacts+to+implement+EN16931
[ustg-4]: https://www.gesetze-im-internet.de/ustg_1980/__4.html
[ustg-12]: https://www.gesetze-im-internet.de/ustg_1980/__12.html
[ustg-13b]: https://www.gesetze-im-internet.de/ustg_1980/__13b.html
[ustg-19]: https://www.gesetze-im-internet.de/ustg_1980/__19.html
[ustg-6a]: https://www.gesetze-im-internet.de/ustg_1980/__6a.html
