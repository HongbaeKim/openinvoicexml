# Security

This library is a stateless invoice-generation engine — no network I/O, no persistence, no
auth. Its main security-relevant property is a minimal dependency footprint (see
[`ARCHITECTURE.md`](ARCHITECTURE.md#no-runtime-dependencies)): fewer third-party dependencies
means less supply-chain surface for a library that processes sensitive financial/invoice data.

Callers are responsible for validating untyped input (this package doesn't run JSON Schema
validation at runtime — see [`API.md`](API.md)) and for their own transport/storage security
around whatever they build with this engine.

For the hosted website's nginx hardening, rate limiting, CSP, and TLS configuration, see
[`openinvoicexml-web`'s `docs/SECURITY.md`](https://github.com/HongbaeKim/openinvoicexml-web/blob/main/docs/SECURITY.md)
— that's a separate deployment with its own attack surface (public HTTP endpoints, a database).

## Responsible disclosure

Found a vulnerability in the engine itself? Email contact@openinvoicexml.de rather than opening
a public issue.
