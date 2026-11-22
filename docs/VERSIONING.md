# Versioning and compatibility

OpenInvoiceXML follows [Semantic Versioning 2.0.0](https://semver.org/) from v1.0.0 on:
MAJOR.MINOR.PATCH. This page defines the public API, what counts as a breaking change, and what
counts as a bug fix.

Before v1.0.0 (0.x releases), a minor release may contain breaking changes. They are marked
**Breaking** in [`CHANGELOG.md`](../CHANGELOG.md).

## Public API

| Area                  | What is protected                                                                                                                                                                                                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Exports               | The exports of `openinvoicexml`, `openinvoicexml/adapters`, `openinvoicexml/browser` and `openinvoicexml/validators` (`package.json` `exports`), as documented in [`API.md`](API.md)                                                                                                                                                                                     |
| TypeScript types      | Every exported type: the `Invoice` model, options, results, issues                                                                                                                                                                                                                                                                                                       |
| Input model           | The `Invoice` type and its JSON Schema (`schemas/invoice.schema.json`, shipped in the package)                                                                                                                                                                                                                                                                           |
| Issue codes           | The documented `code` values of the issues OpenInvoiceXML produces (`ValidationIssue`, and `ComplianceIssue` with `source: "business-rules"`), the `SCHEMA_<KEYWORD>` format, and each code's severity                                                                                                                                                                   |
| Monetary calculations | The rounding method (half away from zero to 2 decimals), the BT-131 order (quantity × unit price rounded on its own, then line charges and allowances), VAT rounded per category, and exact document totals, as documented in [`DATA-MODEL.md`](DATA-MODEL.md#rounding) and [`API.md`](API.md#amount-calculations--calculatelinenetamount-calculatevatamount-sumamounts) |
| Output behavior       | For each function: the document type, syntax and profile it produces, and the documented mapping of `Invoice` fields to the output                                                                                                                                                                                                                                       |
| Runtime               | The minimum Node.js version in `package.json` `engines`, and that `openinvoicexml/browser` contains no Node.js-only code                                                                                                                                                                                                                                                 |

Not covered:

- Files imported by path (for example `openinvoicexml/dist/...`)
- The text of `message` and `suggestedFix`, which is written for people
- Codes and messages from KoSIT, Mustang and veraPDF (`ComplianceIssue` with `source` `"kosit"`,
  `"mustang"` or `"vera-pdf"`): they come from those tools and can change with their versions
- The exact bytes of generated XML and PDF files, and the visual layout of PDFs
- The pinned versions of KoSIT, veraPDF, Mustang and the XRechnung configuration
- Undocumented behavior

## Compliance scope

OpenInvoiceXML generates documents for the standards and profiles it explicitly supports (EN 16931,
XRechnung 3.0 in UBL and CII, Factur-X/ZUGFeRD `EN16931` and `XRECHNUNG`, PDF/A-3b) and tests them
with the validator versions and configurations pinned in this repository (see
[`COMPLIANCE.md`](COMPLIANCE.md#versions-currently-targeted)). It does not promise that every
document will pass future versions of these validators or of the standards. When a new validator
version or configuration changes a result, the fix is released as described below.

## Breaking changes (major version)

- Removing or renaming an export, a type, an `Invoice` field or a documented issue code
- Changing the type of an existing field or parameter in an incompatible way
- Making an optional `Invoice` field required, or making the JSON Schema reject data that conforms to
  the supported standards (a new required field, a shorter `maxLength`, a narrower enum)
- Changing an issue from `warning` to `error`, or adding an `error` that rejects input conforming to
  the supported standards (see the exception under "Bug fixes")
- Changing the documented monetary calculations
- Changing the document type, syntax or profile a function produces, or the documented field mapping,
  for the same input
- Adding a value to a returned union type that breaks documented exhaustive handling (see "TypeScript
  union types")
- Raising the minimum Node.js version
- Adding Node.js-only code to `openinvoicexml/browser`

## Bug fixes (patch or minor version)

A change that corrects behavior which already violated a documented standard is a bug fix, not a
breaking change, even if input that passed before is now rejected or output changes. The documented
standards are EN 16931, the XRechnung CIUS, Peppol BIS Billing 3.0 where these docs say the project
follows it, and the German VAT rules cited in the docs. Examples from 0.6.0: the half-cent rounding
fix, `BR-DEC-16`, and the exact checks for zero-VAT categories.

- A backward-compatible bug fix is released as a patch.
- A correction with substantial user-facing impact (for example previously accepted input is now
  rejected, a `warning` becomes an `error`, or amounts change) is released as a minor version.
- Every such correction is listed in `CHANGELOG.md` under **Fixed**, marked **Behavior change** when
  results change, with the rule it follows (for example `BR-DEC-16` or `PEPPOL-EN16931-R120`).
- An issue code that was wrong for its situation (for example the wrong code for a rule) may be
  corrected the same way; the old and new code are both named in `CHANGELOG.md`.

## Not breaking (minor version)

- New exports, functions, optional `Invoice` fields or options
- New issue codes: new `warning` issues, and new `error` issues under the bug-fix rule above
  (`code` is typed as `string`, so new codes do not break TypeScript)
- Changing an issue from `error` to `warning`, or relaxing a check that was stricter than the standard
  (listed under **Changed**)
- XML or PDF output that differs in bytes or layout but keeps the same business content and still
  passes the tested validator configurations
- Updating the pinned validators or the XRechnung configuration

## TypeScript union types

Adding a value to an exported union is reviewed individually, because it can break `switch`
statements that check every value:

- Unions the caller passes in (for example `EInvoiceProfile`, `VatCategoryCode` and
  `InvoiceOutputFormat` as input): a new accepted value is a minor change.
- Unions the library returns (for example `FileValidationStatus`, `ComplianceSource` and
  `InvoiceFileFormat`): each new value is reviewed individually. If it breaks exhaustive handling that
  these docs show or describe, it requires a major release. Otherwise it may be added in a minor
  release, and `CHANGELOG.md` names the new value.

## Deprecation

A public item is deprecated (`@deprecated` in its type and an entry in `CHANGELOG.md`) in a minor
release before it is removed in the next major release.

## Security fixes

A security fix may change behavior in a patch or minor release if there is no compatible way to fix
it. `CHANGELOG.md` says so.
