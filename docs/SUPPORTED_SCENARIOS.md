# Supported scenarios

The single source of truth for which invoice scenarios, VAT cases, and output formats
OpenInvoiceXML supports today. `README.md` and [`LIMITATIONS.md`](LIMITATIONS.md) link here
instead of keeping their own scenario lists.

A German translation is available: [`SUPPORTED_SCENARIOS.de.md`](SUPPORTED_SCENARIOS.de.md). It is
maintained by hand and may lag behind this file; this English version is authoritative.

Each supported scenario is backed by a fixture in [`fixtures/`](../fixtures/README.md) that is
generated and validated in the test suite. A scenario listed as **Supported** has at least one such
fixture; a scenario with a caveat is listed under **Partially supported**.

Reading guide:

- **Supported** — implemented and exercised by fixtures. The listed caveat, if any, is minor.
- **Partially supported** — works, but a legal condition or field is not checked or modeled. Read
  the caveat before relying on it.
- **Explicitly unsupported** — rejected or out of scope. See [`LIMITATIONS.md`](LIMITATIONS.md)
  for the reasoning.

## Output formats

| Output                                  | Function                                              | Node.js | Browser | Profiles                   |
| --------------------------------------- | ----------------------------------------------------- | ------- | ------- | -------------------------- |
| XRechnung UBL 2.1 XML                   | `toXRechnung()`                                       | Yes     | Yes     | XRechnung                  |
| XRechnung UBL XML with validation       | `generateInvoiceXml()`                                | Yes     | Yes     | XRechnung                  |
| CII XML                                 | `toCii()`                                             | Yes     | No      | `EN16931`, `XRECHNUNG`     |
| Hybrid PDF/A-3 embedding XRechnung UBL  | `toHybridPdf()`                                       | Yes     | Yes     | XRechnung (not Factur-X)   |
| Factur-X/ZUGFeRD PDF/A-3 embedding CII  | `toFacturXPdf()`                                      | Yes     | Yes     | `EN16931`, `XRECHNUNG`     |
| Any of the above through one call       | `generateInvoiceDocument()`                           | Yes     | No      | see function documentation |
| External validation of XML or PDF files | `validateXmlExternally()`, `validateFileExternally()` | Yes     | No      | — (requires Java)          |

Notes:

- The browser entry point is `openinvoicexml/browser`. It contains no Node-only code; external
  validators need Java and run only in Node.js.
- A hybrid PDF made with `toHybridPdf()` embeds UBL, so it is **not** a Factur-X/ZUGFeRD file.
  Use `toFacturXPdf()` for that.
- See [`API.md`](API.md) for signatures and [`COMPLIANCE.md`](COMPLIANCE.md) for how each output
  is validated.

## Supported

### VAT categories

| Scenario                                   | Category | Fixtures               |
| ------------------------------------------ | -------- | ---------------------- |
| Standard rate 19%                          | `S`      | `01`, `02`, `31`, `32` |
| Reduced rate 7%                            | `S`      | `03`                   |
| Multiple VAT rates on one invoice (19%/7%) | `S`      | `28`                   |
| Mixed categories on one invoice (19% + 0%) | `S`, `Z` | `42`                   |
| Zero-rated                                 | `Z`      | `05`                   |
| VAT-exempt (§4 UStG) with exemption reason | `E`      | `04`                   |
| Small business (§19 UStG)                  | `E`      | `07`                   |
| Intra-EU supply (§6a UStG)                 | `K`      | `08`, `44`, `50`       |
| Export outside the EU (§4 Nr. 1 UStG)      | `G`      | `09`, `34`, `45`       |
| Outside the scope of VAT                   | `O`      | `41`                   |
| Reverse charge (§13b UStG), generic        | `AE`     | `06`                   |

### §13b UStG reverse-charge subcases

All 13 subcases that the validator models each have a fixture (`10`–`15`, `27`, `29`, `30`,
`36`–`39`). Combinations with discounts and surcharges: `43`, `46`.

| `reverseChargeReason`     | Fixture |
| ------------------------- | ------- |
| `construction`            | `10`    |
| `scrap-and-waste`         | `11`    |
| `security-transfer`       | `12`    |
| `cleaning`                | `13`    |
| `mobile-devices`          | `14`    |
| `gas-and-electricity`     | `15`    |
| `eu-cross-border-service` | `27`    |
| `real-estate`             | `29`    |
| `telecommunications`      | `30`    |
| `foreign-supplier`        | `36`    |
| `emission-certificates`   | `37`    |
| `qualifying-gold`         | `38`    |
| `industrial-metals`       | `39`    |

A matching tag is necessary but not sufficient proof that reverse charge applies; see
"Partially supported".

### Document types and billing patterns

| Scenario                                                 | Type code | Fixtures         |
| -------------------------------------------------------- | --------- | ---------------- |
| Commercial invoice                                       | `380`     | `01`–`15`        |
| Credit note, full reversal                               | `381`     | `16`             |
| Credit note, partial                                     | `381`     | `17`, `47`       |
| Corrective invoice                                       | `384`     | `18`, `35`, `50` |
| Down payment invoice (Anzahlungsrechnung)                | `380`     | `19`, `48`       |
| Final invoice (Schlussrechnung) deducting a down payment | `380`     | `20`             |
| Partial delivery invoice (Teilrechnung)                  | `380`     | `21`, `49`       |

### Allowances, charges, and amounts

| Scenario                                         | Fixtures   |
| ------------------------------------------------ | ---------- |
| Document-level allowance (BG-20)                 | `22`       |
| Line-level allowance (BG-27)                     | `23`       |
| Line-level and document-level allowance together | `24`       |
| Document-level charge (BG-21)                    | `25`       |
| Line-level charge (BG-28)                        | `26`       |
| Document-level allowance and charge together     | `40`       |
| Unit prices with more than 2 decimals            | `51`, `54` |
| Fractional quantities                            | `53`, `54` |
| Explicit rounding amount (BT-114)                | `52`       |

### Robustness and data shape

| Scenario                                                         | Fixtures   |
| ---------------------------------------------------------------- | ---------- |
| 50+ line items (PDF pagination)                                  | `31`       |
| Umlauts and `ß` in names, long wrapped descriptions              | `32`       |
| Only required fields set                                         | `33`       |
| Seller without VAT ID: Steuernummer (BT-32) as seller identifier | `55`, `56` |

## Partially supported

These scenarios generate valid output, but the engine does not check or model every legal
condition. The caveat is part of the contract.

| Scenario                           | What works                                                                | What is not covered                                                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §13b reverse-charge subcases       | `reverseChargeReason` tag and a matching free-text exemption reason       | Subcase-specific legal preconditions are not verified, such as the €5,000 minimum for `mobile-devices` and `industrial-metals`. A matching keyword is not proof that reverse charge applies |
| §13b insolvency-specific transfers | Falls back to the generic `AE` checks                                     | No dedicated subcase identifier                                                                                                                                                             |
| Small business (§19 UStG)          | Seller tax ID is required, exemption wording is accepted                  | Turnover thresholds (€25,000/€100,000) and the Abs. 3 waiver are not verified                                                                                                               |
| Credit notes (`381`)               | Negative amounts, `precedingInvoiceReference` is required                 | Credited amounts are not cross-checked against the original invoice                                                                                                                         |
| Corrective invoices (`384`)        | Preceding-invoice reference is required                                   | "Only changed lines present" is a convention, not enforced                                                                                                                                  |
| Down payment and final invoice     | Prepaid amount (BT-113) nets down the amount due                          | `precedingInvoiceReference` is a single reference: one prior down payment per final invoice                                                                                                 |
| Partial delivery (Teilrechnung)    | Contract reference (BT-12), free-text `note`                              | No dedicated fields for overall contract value or remaining balance; EN 16931 has no business term for either                                                                               |
| Export                             | Category `G` with exemption wording and code                              | No dedicated customs reference field. Use `note` (BT-22); see fixture `34`                                                                                                                  |
| Place of supply                    | Default and B2B-service override, reported as a non-blocking warning      | Goods vs. services, B2C, and special categories (real estate, transport, events, catering) are not modeled                                                                                  |
| Buyer reference (BT-10)            | Presence is required for the XRechnung profile                            | Leitweg-ID format is not checked, and B2G is not distinguished from B2B                                                                                                                     |
| Deliver-to address                 | Country code (BT-80) is enforced                                          | City and postal code (`BR-DE-10`/`BR-DE-11`) are not checked here; KoSIT rejects them when missing                                                                                          |
| Payment means and payment terms    | Written to the output when set                                            | `BR-DE-1` (payment means required) and `BR-CO-25` (due date or terms required when an amount is owed) are not checked here; KoSIT enforces both                                             |
| Browser output validation          | Business rules run in the browser; CI checks the tested scenarios         | KoSIT and Mustang need Java and cannot run in the browser. Send the XML to a Node backend and call `validateXmlExternally()`                                                                |
| Existing files from other software | `validateFileExternally()` runs KoSIT, Mustang, and veraPDF as applicable | OpenInvoiceXML business rules are not run, because uploaded files are not converted back into an `Invoice`                                                                                  |

## Explicitly unsupported

| Item                                                             | Behavior                                                                                                                                                                                            |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VAT codes `L` (Canary Islands IGIC) and `M` (Ceuta/Melilla IPSI) | Not in the VAT category type; out of scope for a Germany-focused engine                                                                                                                             |
| Category `S` rates other than 19% and 7%                         | Rejected as `VAT_RATE_INVALID_FOR_CATEGORY`, including historical 16%/5% rates                                                                                                                      |
| Factur-X/ZUGFeRD profiles `MINIMUM`, `BASIC WL`, `BASIC`         | Not in the `EInvoiceProfile` type, which is `"XRECHNUNG"` or `"EN16931"`. `MINIMUM` and `BASIC WL` carry no invoice lines and are not valid e-invoices in Germany; `BASIC` is a subset of `EN16931` |
| Importing an invoice file into the `Invoice` model               | Files can only be validated externally, not parsed back into the model                                                                                                                              |
| Running KoSIT, Mustang, or veraPDF in the browser                | Requires Java; Node.js only                                                                                                                                                                         |
| Choosing between multiple invoice XMLs in one PDF                | `validateFileExternally()` reports the problem and does not guess                                                                                                                                   |

## Keeping this file current

When a scenario is added, change its row here in the same change. Add a fixture and a row in
[`fixtures/README.md`](../fixtures/README.md) first; this file only summarizes what those fixtures
and the validators prove.
