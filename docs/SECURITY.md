# Security

This library is a stateless invoice-generation engine — no network I/O, no persistence, no
auth. It processes sensitive financial data, so this page explains what the engine protects against,
what the caller is responsible for, and how to report a security problem.

## What the engine protects against

- **Invalid input.** `generateInvoice()`, `generateCii()`, `generateHybridPdf()` and
  `generateFacturXPdf()` first use `validateInvoiceSchema()` to check the invoice structure.
  It checks required fields, data types, formats, unknown fields, and text length limits.
  Invalid input returns `SCHEMA_*` errors and no output instead of crashing.
  See [`API.md`](API.md#validateinvoiceschemadata--structural-validation).

- **Invalid invoice rules.** Business rules are checked next, including VAT, §13b requirements,
  totals and rounding. If an error is found, no invoice is generated.

- **XML injection.** `toXRechnung()` and `toCii()` escape special XML characters such as
  `& < > "`. This prevents input values from changing the XML structure, even when these
  functions are called directly without schema validation.

- **Dependencies.** The project keeps dependencies limited and documented.
  See [`DEVELOPMENT.md`](DEVELOPMENT.md#dependency-policy). `npm audit` was clean when this
  page was last updated.

## What the engine does not handle

- **File uploads and untrusted paths.** The engine does not manage uploaded files or protect
  file paths provided by users. Applications using the engine should handle this safely with
  temporary filenames, file-size limits and file-type checks. For the hosted service, this is
  handled by `openinvoicexml-web`.

- **PDF text security.** The hybrid PDF text-rendering path has not yet had a separate injection
  security review. Input length is limited, but handling of malicious PDF text still needs review.

- **Browser input validation.** `generateInvoiceXml()` (`openinvoicexml/browser`) does not run
  `validateInvoiceSchema()` because AJV is Node-only. It expects an already structurally valid
  `Invoice`.

- **Transport, storage and access control.** The engine does not manage how invoice data is
  transmitted, stored, or protected by the application using it.

For the hosted website's nginx hardening, rate limiting, CSP, and TLS configuration, see
[`openinvoicexml-web`'s `docs/SECURITY.md`](https://github.com/HongbaeKim/openinvoicexml-web/blob/main/docs/SECURITY.md)
— that's a separate deployment with its own attack surface (public HTTP endpoints, a database).

## Responsible disclosure

Found a vulnerability in the engine itself? Email contact@openinvoicexml.de rather than opening
a public issue. Include the affected version, a minimal input that reproduces it, and what you
expect to happen versus what does.

We aim to acknowledge a report within 5 working days and to share a fix plan or assessment within
30 days. This is a best-effort open-source project, not a service-level commitment. Please give us
a reasonable chance to fix the issue before public disclosure.
