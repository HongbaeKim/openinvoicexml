# API

Usage reference for the generation modules: the unified `generateInvoiceDocument` entry point,
`generateInvoice`/`toXRechnung` (UBL XML), `generateInvoiceXml` (also available from the browser-safe `openinvoicexml/browser`), `validateXmlExternally` (KoSIT + Mustang on existing XML), `validateFileExternally`/`detectInvoiceFormat` (validate an existing XML or PDF invoice file), `generateCii`/`toCii` (CII XML), the hybrid PDF/A-3
counterparts `generateHybridPdf`/`toHybridPdf` (UBL attachment, no Factur-X/ZUGFeRD claim) and
`generateFacturXPdf`/`toFacturXPdf` (CII embedded via `embedFacturX()`, a genuine Factur-X/ZUGFeRD
conformance claim), and the `ValidationIssue` error-code contract shared between them. `runKosit`,
`runVeraPdf`, and `runMustang`/`extractWithMustang` are documented separately at the end as
optional, external validation layers.

For the `Invoice` input shape itself (fields, types, BT mapping), see
[`DATA-MODEL.md`](DATA-MODEL.md) rather than re-reading it here.

## `generateInvoiceDocument(invoice, options)` — unified entry point

```ts
import { generateInvoiceDocument } from "openinvoicexml/adapters";

const result = await generateInvoiceDocument(invoice, { format: "XRECHNUNG_UBL" });
```

- **Input:** `Invoice`, plus `GenerateInvoiceDocumentOptions` (a required `format`)
- **Output:** `GenerateInvoiceDocumentResult`

```ts
type InvoiceOutputFormat =
  "XRECHNUNG_UBL" | "XRECHNUNG_CII" | "FACTURX_EN16931" | "FACTURX_XRECHNUNG";

interface GenerateInvoiceDocumentOptions {
  format: InvoiceOutputFormat;
}

type GenerateInvoiceDocumentResult =
  | {
      format: "XRECHNUNG_UBL";
      contentType: "xml";
      content: string | null;
      issues: ValidationIssue[];
    }
  | {
      format: "XRECHNUNG_CII";
      contentType: "xml";
      content: string | null;
      issues: ValidationIssue[];
    }
  | {
      format: "FACTURX_EN16931";
      contentType: "pdf";
      content: Uint8Array | null;
      issues: ValidationIssue[];
    }
  | {
      format: "FACTURX_XRECHNUNG";
      contentType: "pdf";
      content: Uint8Array | null;
      issues: ValidationIssue[];
    };
```

`generateInvoiceDocument` is a routing/composition layer, not a fifth serializer: it picks the
existing recommended entry point for the requested `format` (`generateInvoice`/`generateCii`/
`generateFacturXPdf`, documented individually below) and re-keys that function's own `xml`/`pdf`
field to a uniform `content`/`contentType` shape, so a caller that doesn't know a format's
syntax ahead of time can branch on `result.contentType` instead. Each branch keeps the same
null-on-error convention as the function it delegates to — `content` is `null`, and `issues`
contains at least one `severity: "error"` entry, exactly when the invoice fails
`validateBusinessRules`.

| `format`            | Underlying adapter                                                  | `contentType` | Use case                                                |
| ------------------- | ------------------------------------------------------------------- | ------------- | ------------------------------------------------------- |
| `XRECHNUNG_UBL`     | `toXRechnung` (via `generateInvoice`)                               | `xml`         | XRechnung XML using UBL syntax                          |
| `XRECHNUNG_CII`     | `toCii({ profile: "XRECHNUNG" })` (via `generateCii`)               | `xml`         | XRechnung XML using CII syntax                          |
| `FACTURX_EN16931`   | `toFacturXPdf({ profile: "EN16931" })` (via `generateFacturXPdf`)   | `pdf`         | Factur-X/ZUGFeRD hybrid PDF using the EN16931 profile   |
| `FACTURX_XRECHNUNG` | `toFacturXPdf({ profile: "XRECHNUNG" })` (via `generateFacturXPdf`) | `pdf`         | Factur-X/ZUGFeRD hybrid PDF using the XRechnung profile |

XRechnung is a syntax-agnostic _content_ profile — both `XRECHNUNG_UBL` and `XRECHNUNG_CII`
satisfy it, just in different XML syntaxes; Germany's mandate isn't UBL-specific, which is the
whole reason this project built a CII adapter alongside the original UBL one.

```ts
const result = await generateInvoiceDocument(invoice, { format: "FACTURX_XRECHNUNG" });

if (result.content === null) {
  for (const issue of result.issues) console.error(`${issue.code}: ${issue.message}`);
} else if (result.contentType === "pdf") {
  writeFileSync("invoice.pdf", result.content); // Uint8Array
} else {
  writeFileSync("invoice.xml", result.content); // string
}
```

## `generateInvoice(invoice, options)` — recommended entry point

```ts
import { generateInvoice } from "openinvoicexml/adapters";

const result = generateInvoice(invoice);
```

- **Input:** `Invoice` (a fully-populated internal invoice object — see `DATA-MODEL.md`), plus an
  optional `GenerateInvoiceOptions`
- **Output:** `GenerateInvoiceResult`

```ts
interface GenerateInvoiceOptions {
  /**
   * Opt-in: additionally shells out to the real KoSIT validator (Java — see `make
   * kosit-setup`) against the generated XML and merges its findings into
   * `complianceIssues`. Off by default.
   */
  validateExternally?: boolean;
}

interface GenerateInvoiceResult {
  /** The generated XRechnung XML, or null if business-rule validation found an error. */
  xml: string | null;
  /** All business-rule issues found, including non-blocking warnings. */
  issues: ValidationIssue[];
  /**
   * `issues` above, plus real KoSIT findings against the generated XML, normalized to
   * `ComplianceIssue` (see "Unified compliance diagnostics" below). Present only when
   * called with `{ validateExternally: true }` — absent, not just empty, on the default call.
   */
  complianceIssues?: ComplianceIssue[];
}
```

`generateInvoice` validates in two layers, in order. First [`validateInvoiceSchema`](#validateinvoiceschemadata--structural-validation)
checks the structure (required fields, types, formats, unknown properties, length caps); if it
finds anything, `xml` is `null`, `issues` holds only the `SCHEMA_*` errors, and the business
rules are skipped (they assume a structurally valid invoice). Then `validateBusinessRules` runs.
If any issue has `severity: "error"`, `xml` is `null` and the errors are returned in `issues` —
no XML is produced for a known-non-compliant invoice. Otherwise `xml` contains the generated
UBL 2.1 document (`issues` may still contain non-blocking `warning` entries). This is
`generateInvoice`'s default contract: compose validation + generation, gate output on
error-severity issues, and return a result instead of throwing, even for malformed input
(`null`, missing `lines`, wrong types) — synchronous, no Java required. `generateCii`,
`generateHybridPdf` and `generateFacturXPdf` apply the same schema gate first.

`generateInvoiceXml()` (the browser-safe variant) does **not** run the schema layer: it needs
AJV, which is Node-only, so it assumes a structurally valid `Invoice`.

```ts
const { xml, issues } = generateInvoice(invoice);

if (xml === null) {
  // issues contains at least one severity: "error" entry — do not send this invoice
  for (const issue of issues) console.error(`${issue.code}: ${issue.message}`);
} else {
  writeFileSync("invoice.xml", xml);
}
```

Pass `{ validateExternally: true }` to additionally run the real KoSIT validator against the
generated XML and get every finding — this project's own plus KoSIT's — back as one normalized
`ComplianceIssue[]` list. This is opt-in and requires Java/the KoSIT jar (`make kosit-setup`);
the default call above never needs either:

```ts
const { xml, complianceIssues } = generateInvoice(invoice, { validateExternally: true });

for (const issue of complianceIssues ?? []) {
  // issue.source is "business-rules" or "kosit"; issue.suggestedFix is set only for
  // this project's own (business-rules) codes — see "Unified compliance diagnostics" below
  console.log(`[${issue.source}] ${issue.code}: ${issue.message}`);
}
```

## `generateInvoiceXml(invoice)` — validated XRechnung XML

```ts
// Node.js
import { generateInvoiceXml } from "openinvoicexml/adapters";

// Browser
import { generateInvoiceXml } from "openinvoicexml/browser";

const { xml, issues } = generateInvoiceXml(invoice);
```

Both imports are the same function.

- **Input:** `Invoice`
- **Output:** `{ xml, issues }`

`generateInvoiceXml()` checks the invoice with OpenInvoiceXML's business rules and creates XRechnung UBL XML. Errors stop XML creation; warnings do not. For CII XML, use [`generateCii()`](#generateciiinvoice-options--recommended-entry-point).

`generateInvoice(invoice)` without options returns the same result. Use `generateInvoice()` when you need its Node-specific options, such as `validateExternally`; use `generateInvoiceXml()` when you specifically want validated XRechnung UBL XML.

### Browser entry (`openinvoicexml/browser`)

`openinvoicexml/browser` is made for browser apps such as React, Vue, and browser extensions. It does not use Node.js.

Available from `openinvoicexml/browser`:

- `generateInvoiceXml`
- `toXRechnung`
- `validateBusinessRules`
- Related TypeScript types

PDF generation and external validators are not available in the browser. KoSIT, Mustang, and veraPDF need Java and must run on a Node backend.

CI checks the XML created by `generateInvoiceXml()` with KoSIT and Mustang for all scenarios in the browser-validation test suite.

To check a user's actual XML with KoSIT and Mustang, send it to a Node backend and call [`validateXmlExternally()`](#validatexmlexternallyxml-options--kosit--mustang).

See [`COMPLIANCE.md`](COMPLIANCE.md#browser-generated-xml-openinvoicexmlbrowser) for more details.

## `toXRechnung(invoice)` — low-level building block

```ts
import { toXRechnung } from "openinvoicexml/adapters";

const xml: string = toXRechnung(invoice);
```

- **Input:** `Invoice`
- **Output:** a UBL 2.1 XML string (always produced, no validation)

`toXRechnung` performs **no schema or business-rule validation** — it maps the invoice straight
to XML and always returns a document, even one that would fail `validateInvoiceSchema`,
`validateBusinessRules` or KoSIT. It assumes a pre-validated, structurally correct `Invoice`
(a missing `lines` array makes it throw). Use it only when you validate separately; otherwise
prefer `generateInvoice`, which does both. What it does guarantee on its own: every string it
writes into the XML is escaped (`& < > "`), including values interpolated into attributes such
as `currencyID`, so even an unvalidated field cannot inject markup. `toCii` gives the same
escaping guarantee.

## `validateInvoiceSchema(data)` — structural validation

```ts
import { validateInvoiceSchema } from "openinvoicexml/validators";

const issues = validateInvoiceSchema(JSON.parse(body)); // data: unknown
if (issues.length > 0) {
  // [{ code: "SCHEMA_REQUIRED", severity: "error", message: "...", path: "seller" }, ...]
}
```

- **Input:** `unknown` — safe for untyped data (parsed JSON, form input)
- **Output:** `ValidationIssue[]`, empty when the structure is valid; never throws

Checks `data` against `schemas/invoice.schema.json` with AJV and reports **all** problems in one
pass. Issue `code` is `SCHEMA_` plus the upper-cased JSON Schema keyword (`SCHEMA_REQUIRED`,
`SCHEMA_TYPE`, `SCHEMA_PATTERN`, `SCHEMA_ENUM`, `SCHEMA_FORMAT`, `SCHEMA_MAXLENGTH`,
`SCHEMA_ADDITIONALPROPERTIES`, ...) and `path` uses the same notation as `validateBusinessRules`
(`lines[0].vatRate`). Structure only — VAT arithmetic and legal rules are
`validateBusinessRules`. Not available from `openinvoicexml/browser`.

Free-text fields are length-capped: 10,000 characters for `note`, line `description`,
exemption/allowance-charge reasons and `accountName`; 500 for every other free string (names,
addresses, ids, references).

## `generateHybridPdf(invoice, options)` — recommended entry point

```ts
import { generateHybridPdf } from "openinvoicexml/adapters";

const result = await generateHybridPdf(invoice);
```

- **Input:** `Invoice`, plus an optional `HybridPdfOptions`
- **Output:** `GenerateHybridPdfResult`

```ts
interface HybridPdfOptions {
  /** Defaults to "EN16931". */
  profile?: EInvoiceProfile;
}

type EInvoiceProfile = "XRECHNUNG" | "EN16931";

interface GenerateHybridPdfResult {
  /** The generated hybrid PDF bytes, or null if business-rule validation found an error. */
  pdf: Uint8Array | null;
  /** All business-rule issues found, including non-blocking warnings. */
  issues: ValidationIssue[];
}
```

Same gate as `generateInvoice`: runs `validateBusinessRules` first, and returns `pdf: null` with
the errors in `issues` if any issue is `severity: "error"`. Otherwise `pdf` contains a PDF/A-3b
invoice with the XRechnung UBL XML embedded as an associated file.

`profile` currently has no effect on generated output. Hybrid PDF generation currently embeds
the same UBL XRechnung XML for both supported values — `"EN16931"` is currently just an accepted
profile selection in the API, not a request for a separate generic EN 16931 serialization;
`toXRechnung()` always produces the same XRechnung UBL document regardless of which value is
passed. Only `"XRECHNUNG"` and `"EN16931"` are supported: this project's hybrid PDF embeds UBL,
and every Factur-X/ZUGFeRD conformance level (MINIMUM/BASIC WL/BASIC) requires CII — see
[`LIMITATIONS.md`](LIMITATIONS.md).

## `toHybridPdf(invoice, options)` — low-level building block

```ts
import { toHybridPdf } from "openinvoicexml/adapters";

const pdf: Uint8Array = await toHybridPdf(invoice);
```

- **Input:** `Invoice`, plus an optional `HybridPdfOptions` (same shape as above)
- **Output:** PDF/A-3b bytes (always produced, no validation)

`toHybridPdf` performs **no business-rule validation** — same relationship to `generateHybridPdf`
that `toXRechnung` has to `generateInvoice`. Use this only when you validate separately; otherwise
prefer `generateHybridPdf`. Check PDF/A-3b conformance separately with veraPDF (`runVeraPdf`,
below, or [`COMPLIANCE.md`](COMPLIANCE.md#validating-this-projects-output)).

## `generateCii(invoice, options)` — recommended entry point

```ts
import { generateCii } from "openinvoicexml/adapters";

const result = generateCii(invoice, { profile: "XRECHNUNG" });
```

- **Input:** `Invoice`, plus an optional `{ profile?: EInvoiceProfile }` (same shape as `toCii`,
  defaults to `"EN16931"`)
- **Output:** `GenerateCiiResult`

```ts
interface GenerateCiiResult {
  /** The generated CII XML, or null if business-rule validation found an error. */
  xml: string | null;
  /** All business-rule issues found, including non-blocking warnings. */
  issues: ValidationIssue[];
}
```

Same gate as `generateInvoice`, for `toCii` instead of `toXRechnung`: runs `validateBusinessRules`
first, and returns `xml: null` with the errors in `issues` if any issue is `severity: "error"`.
Otherwise `xml` contains the generated CII document for the requested profile. `generateCii` is
synchronous, like `generateInvoice` and `toXRechnung`/`toCii` themselves — only the PDF-producing
functions (`generateHybridPdf`/`generateFacturXPdf`) are async.

`validateBusinessRules` is itself profile-aware: `generateCii` passes `options.profile` through to
it, so requesting `{ profile: "XRECHNUNG" }` also enforces XRechnung-only requirements that plain
EN16931 doesn't have (currently just BT-10 buyer reference cardinality — see
[`COMPLIANCE.md`](COMPLIANCE.md) and [`DATA-MODEL.md`](DATA-MODEL.md)). `generateInvoice`/
`generateHybridPdf` always validate as `"XRECHNUNG"` regardless of any option, since their output
is always genuine XRechnung XML/PDF either way.

## `toCii(invoice, options)` — low-level building block

```ts
import { toCii } from "openinvoicexml/adapters";

const xml: string = toCii(invoice, { profile: "EN16931" });
```

- **Input:** `Invoice`, plus an optional `{ profile?: EInvoiceProfile }` (defaults to `"EN16931"`)
- **Output:** a UN/CEFACT CII (Cross Industry Invoice) XML string (always produced, no validation)

`toCii` performs **no business-rule validation** — same relationship to any `generate*` entry
point that `toXRechnung` has to `generateInvoice`. Unlike `toHybridPdf`'s `profile` option, this
one is a real branch, not a no-op: it selects which `GuidelineSpecifiedDocumentContextParameter`
URN gets written (`urn:cen.eu:en16931:2017` for `"EN16931"`, the XRechnung-compliant URN for
`"XRECHNUNG"`) — which determines which of KoSIT's two real CII scenarios the output matches
(`EN16931 (CII)` vs. `EN16931 XRechnung (CII)`). Every Factur-X/ZUGFeRD conformance level requires
CII, not UBL — this is what makes `toFacturXPdf` (below) a genuine conformance claim where
`toHybridPdf` isn't. See [`COMPLIANCE.md`](COMPLIANCE.md#validating-this-projects-output) and
[`LIMITATIONS.md`](LIMITATIONS.md).

## `generateFacturXPdf(invoice, options)` — recommended entry point

```ts
import { generateFacturXPdf } from "openinvoicexml/adapters";

const result = await generateFacturXPdf(invoice);
```

- **Input:** `Invoice`, plus an optional `HybridPdfOptions` (same shape as `generateHybridPdf`)
- **Output:** `GenerateFacturXPdfResult`

```ts
interface GenerateFacturXPdfResult {
  /** The generated Factur-X/ZUGFeRD hybrid PDF bytes, or null if business-rule validation found an error. */
  pdf: Uint8Array | null;
  /** All business-rule issues found, including non-blocking warnings. */
  issues: ValidationIssue[];
}
```

Same gate as `generateHybridPdf`, but produces a genuine Factur-X/ZUGFeRD hybrid PDF: the CII
invoice XML is embedded via `embedFacturX()` (which sets the `fx:ConformanceLevel`/
`fx:DocumentFileName` XMP properties and PDF/A extension schema, and performs the PDF/A-3
conversion itself), not the plain UBL attachment `generateHybridPdf`/`toHybridPdf` produce.
Like `generateCii`, business-rule validation here is gated on `options.profile` (defaulting to
`"EN16931"`, same as `toFacturXPdf`) — pass `{ profile: "XRECHNUNG" }` to also enforce
XRechnung-only requirements such as BT-10's mandatory cardinality.

## `toFacturXPdf(invoice, options)` — low-level building block

```ts
import { toFacturXPdf } from "openinvoicexml/adapters";

const pdf: Uint8Array = await toFacturXPdf(invoice);
```

- **Input:** `Invoice`, plus an optional `HybridPdfOptions` (same shape as above)
- **Output:** PDF/A-3b bytes with an embedded, genuinely conformant Factur-X/ZUGFeRD CII invoice
  (always produced, no validation)

`toFacturXPdf` performs **no business-rule validation** — same relationship to `generateFacturXPdf`
that `toHybridPdf` has to `generateHybridPdf`. It shares the same visual layout as `toHybridPdf`
(same `drawHeader`/`drawLineItemsTable`/`drawTotalsBlock`/`drawPaymentInfo`/`drawFooter` code) but
embeds `toCii(invoice, { profile })` via `embedFacturX()` instead of `toXRechnung()` via a plain
attachment — a genuine Factur-X/ZUGFeRD conformance claim, unlike `toHybridPdf`'s UBL attachment.

`profile` (defaults to `"EN16931"`) maps onto `embedFacturX()`'s `conformanceLevel`:
`"EN16931"` → `"EN 16931"` (note the space — `@cantoo/pdf-lib`'s `FacturXConformanceLevel`
spelling, distinct from this project's own `EInvoiceProfile` spelling), `"XRECHNUNG"` →
`"XRECHNUNG"` unchanged. Check PDF/A-3b conformance and CII conformance separately — veraPDF for
PDF/A-3b, KoSIT for the embedded CII (`extractEmbeddedXml(path, "factur-x.xml")`, the same
function `toHybridPdf` output uses, with an explicit second argument for this attachment's
different file name) — see
[`COMPLIANCE.md`](COMPLIANCE.md#validating-this-projects-output).

## `ValidationIssue` — error-code contract

`validateBusinessRules(invoice)` (used internally by `generateInvoice`, also importable
directly from `openinvoicexml/validators`) returns `ValidationIssue[]`:

```ts
interface ValidationIssue {
  /** Machine-readable rule identifier. */
  code: string;
  /** "error" blocks compliant output; "warning" is informational. */
  severity: "error" | "warning";
  /** Human-readable description, referencing the relevant BT/BG code. */
  message: string;
  /** Location of the offending field, e.g. "lines[1].vatRate" or "vatBreakdowns[0]". */
  path: string;
}
```

`code` is a stable, machine-matchable identifier — safe to switch on, unlike `message`, which is
for humans. Almost every issue is `severity: "error"`; the exceptions are
`PLACE_OF_SUPPLY_CROSS_BORDER` (`"warning"`, never blocks `generateInvoice` — see
[`LIMITATIONS.md`](LIMITATIONS.md)) and `ISSUE_DATE_IN_FUTURE`. Structural problems come from
[`validateInvoiceSchema`](#validateinvoiceschemadata--structural-validation) with `SCHEMA_*`
codes in the same shape. A few representative codes:

| Code                                     | Severity  | Meaning                                                                              |
| ---------------------------------------- | --------- | ------------------------------------------------------------------------------------ |
| `VAT_RATE_INVALID_FOR_CATEGORY`          | `error`   | Category `S` at a rate other than 19%/7%, or a zero-rate category at a non-zero rate |
| `LINE_AMOUNT_ROUNDING`                   | `error`   | BT-131 line net amount doesn't match `quantity × unitPrice`                          |
| `REVERSE_CHARGE_BUYER_VAT_ID_REQUIRED`   | `error`   | Category `AE` used without a buyer VAT ID                                            |
| `VAT_EXEMPTION_REASON_REQUIRED`          | `error`   | Exemption category (`E`/`AE`/`K`/`G`/`O`) missing a reason (BT-120/BT-121)           |
| `PLACE_OF_SUPPLY_CROSS_BORDER`           | `warning` | Seller/buyer countries differ — informational only                                   |
| `ISSUE_DATE_IN_FUTURE`                   | `warning` | BT-2 issue date is later than today (UTC) — legal but usually a typo                 |
| `SCHEMA_REQUIRED` (and other `SCHEMA_*`) | `error`   | Structural problem found by `validateInvoiceSchema`; business rules are skipped      |

Not exhaustive — see `validators/engines/02.business-rules.ts` and `validators/rules/17.vat-rate.ts` for
the full, current set.

## Unified compliance diagnostics — `ComplianceIssue`

`ValidationIssue` (above), `KositIssue`, `VeraPdfIssue`, and `MustangIssue` are four
independently-shaped types — a caller who wants findings from more than one validator has to
handle each shape separately. `ComplianceIssue` (`openinvoicexml/validators`) normalizes all four
into one:

```ts
interface ComplianceIssue {
  /** Machine-readable rule identifier — this project's own code, KoSIT's bracketed rule id
   * (e.g. "BR-DE-14"), veraPDF's PDF/A clause number (e.g. "6.3.4"), or Mustang's Schematron
   * rule test (e.g. "normalize-space(cbc:ID) != ''"). */
  code: string;
  severity: "error" | "warning";
  message: string;
  /** This project's own dot-path for a business-rules issue; the raw XPath/context location
   * KoSIT/veraPDF/Mustang reported, or "" if the underlying issue had none. */
  path: string;
  /** Which validator this came from. */
  source: "business-rules" | "kosit" | "vera-pdf" | "mustang";
  /** Set only for "business-rules" issues with a known fix (see SUGGESTED_FIXES below) —
   * never synthesized for KoSIT/veraPDF/Mustang's free-text, version-dependent messages. */
  suggestedFix?: string;
}
```

Four converter functions build a `ComplianceIssue[]` from each validator's own output:

```ts
import {
  fromValidationIssue,
  fromKositIssue,
  fromVeraPdfIssue,
  fromMustangIssue,
} from "openinvoicexml/validators";

const issues = [
  ...validateBusinessRules(invoice).map(fromValidationIssue),
  ...runKosit(["invoice.xml"])[0]!.issues.map(fromKositIssue),
  ...runVeraPdf(["invoice.pdf"])[0]!.issues.map(fromVeraPdfIssue),
  ...runMustang(["invoice.xml"])[0]!.issues.map(fromMustangIssue),
];
```

`generateInvoice(invoice, { validateExternally: true })` (above) already does the
`fromValidationIssue`/`fromKositIssue` half of this for you — call these converters directly only
when composing your own validation pipeline (e.g. also including veraPDF, or validating a PDF this
project didn't generate).

`SUGGESTED_FIXES: Record<string, string>` covers every `code` this project's own
`validateBusinessRules()` currently produces (kept complete by a regression test that greps
`validators/engines/02.business-rules.ts` and `validators/rules/*.ts` for every `code:` literal and checks
it has an entry). No equivalent lookup exists for KoSIT/veraPDF codes — their messages are
free-text from external Java tools, version-dependent, and pattern-matching against them to guess
a fix would be fragile and misleading when wrong; surfacing `source` plus the tool's own message
honestly is more useful than a guessed-wrong suggestion.

## `validateXmlExternally(xml, options)` — KoSIT + Mustang

```ts
import { validateXmlExternally } from "openinvoicexml/adapters";

const result = validateXmlExternally(xmlBytes);
```

- **Input:** XML as `string` or `Uint8Array`
- **Output:** KoSIT and Mustang results

Node-only because KoSIT and Mustang require Java.

Use this to check XML that already exists, including the exact XML created by `generateInvoiceXml()` in a browser.

KoSIT and Mustang are reported separately:

- **Passed:** validator ran and accepted the XML.
- **Failed:** validator ran and found errors.
- **Unavailable:** validator could not run, for example because Java or the validator is missing.

When `Uint8Array` is used, the exact bytes are validated without changing them. Temporary files are deleted after validation.

`kositScenario` is the KoSIT scenario the XML was checked under. A KoSIT pass only means it passed that scenario's rules — see [`COMPLIANCE.md`](COMPLIANCE.md#check-the-matched-scenario-not-just-valid).

`generateInvoice(invoice, { validateExternally: true })` is different and runs KoSIT only.

---

## `validateFileExternally(bytes, options)` — validate an existing file

```ts
import { validateFileExternally } from "openinvoicexml/adapters";

const report = await validateFileExternally(uploadedBytes);
// PASS | FAIL | UNAVAILABLE | UNSUPPORTED
```

- **Input:** exact file bytes as `Uint8Array`
- **Output:** `FileValidationResult`

Node-only. Use this to check an existing XML or PDF, including files created by other software. The file is not changed.

The format is detected from its content, not its file name:

| File                 | Checks                    |
| -------------------- | ------------------------- |
| UBL / CII XML        | KoSIT + Mustang           |
| Factur-X/ZUGFeRD PDF | veraPDF + KoSIT + Mustang |
| Hybrid PDF with UBL  | veraPDF + KoSIT + Mustang |
| Invalid XML/PDF      | Reported as failed        |
| Other file           | Unsupported               |

For PDFs, the embedded invoice XML is detected by its content. If no invoice XML or more than one is found, validation fails instead of guessing which one to use.

### Result

- **PASS:** all applicable checks passed.
- **FAIL:** the file or one of its checks failed.
- **UNAVAILABLE:** a required validator could not run.
- **UNSUPPORTED:** the file is neither a supported XML nor PDF.

A PASS means the **file format** passed the applicable KoSIT, Mustang and veraPDF checks. It does not confirm that invoice information such as amounts, VAT treatment or parties is correct.

`kositScenario` is the KoSIT scenario the invoice XML was checked under. Show it next to the result; a KoSIT pass only means it passed that scenario's rules — see [`COMPLIANCE.md`](COMPLIANCE.md#check-the-matched-scenario-not-just-valid).

Temporary files are deleted after validation.

## `runKosit(files, options)` — optional external validation

```ts
import { runKosit } from "openinvoicexml/validators";

const results = runKosit(["invoice.xml"]);
```

A separate, optional layer: it shells out to the official [KoSIT validator][kosit-validator]
against already-generated XML files on disk. It's additive to `validateBusinessRules`, confirming
full XRechnung Schematron/XSD conformance — it isn't part of the in-process
`generateInvoice`/`toXRechnung` pipeline and requires a local Java + KoSIT jar setup
(`make kosit-setup`). See [`COMPLIANCE.md`](COMPLIANCE.md#validating-this-projects-output) for
setup and the `KositResult`/`KositIssue` shapes.

Each result has an optional `scenarioName`: the KoSIT scenario the file was checked under. Check
it against the scenario you expected, not just `valid` — see
[`COMPLIANCE.md`](COMPLIANCE.md#check-the-matched-scenario-not-just-valid).

[kosit-validator]: https://github.com/itplr-kosit/validator

## `runVeraPdf(files, options)` — optional external validation

```ts
import { runVeraPdf } from "openinvoicexml/validators";

const results = runVeraPdf(["invoice.pdf"]);
```

A separate, optional layer: it shells out to the installed [veraPDF][verapdf-tool] CLI against
already-generated PDF files on disk. It's the PDF/A-3 counterpart to `runKosit` — confirms
ISO 19005-3 conformance for the hybrid PDF adapter's output — and requires veraPDF to be set up
with `make verapdf-setup`; that setup uses either a compatible system Java or the project's
portable JRE (no local Java install required beforehand). See
[`COMPLIANCE.md`](COMPLIANCE.md#validating-this-projects-output) for setup and the
`VeraPdfResult`/`VeraPdfIssue` shapes.

[verapdf-tool]: https://github.com/veraPDF/veraPDF-apps

## `runMustang(files, options)` / `extractWithMustang(pdfPath, options)` — optional external validation

```ts
import { runMustang, extractWithMustang } from "openinvoicexml/validators";

const extracted = extractWithMustang("invoice.pdf");
const results = runMustang(["invoice.xml"]);
```

A separate, optional layer: it shells out to the [Mustang Project][mustang-tool] CLI as an
independent, third-party second opinion alongside `runKosit`/`runVeraPdf`. `extractWithMustang`
recovers the embedded XML from a hybrid PDF using Mustang's own extractor — deliberately not this
project's own `extractEmbeddedXml()` (`adapters/hybrid-pdf.ts`) — so it can prove a hybrid PDF is
genuinely readable by an independent tool, not just self-consistent with this project's own code.
`runMustang` validates an XRechnung UBL XML file (or, as a secondary capability, a PDF directly)
against Mustang's own EN16931/XRechnung Schematron and XSD rules. Requires
`make mustang-setup`. See [`COMPLIANCE.md`](COMPLIANCE.md#validating-this-projects-output) for
setup, the recommended extract-then-validate flow, and the `MustangResult`/`MustangIssue` shapes.

[mustang-tool]: https://github.com/ZUGFeRD/mustangproject
