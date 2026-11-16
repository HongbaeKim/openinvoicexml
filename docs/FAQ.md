# FAQ

Practical questions from freelancers and small businesses. This page is not for developers; for
code, see [`EXAMPLES.md`](EXAMPLES.md) and [`API.md`](API.md).

OpenInvoiceXML checks the rules it implements. It is not legal or tax advice, and a passing result
does not replace a check by your tax advisor (Steuerberater). Dates and thresholds below can change,
so confirm them with the Bundesfinanzministerium (BMF) or your advisor before you rely on them.

## Legal and tax questions

### Is this legal or tax advice?

No. The library checks invoices against EN 16931 and XRechnung rules and reports what it finds. It
does not decide whether your invoice is correct for your tax situation, and the receiving system has
the final say. What is not covered is listed in [`LIMITATIONS.md`](LIMITATIONS.md).

### Do I have to switch to XRechnung yet?

It depends on whether you send or receive, and on your turnover. As of this writing, the rules
for domestic B2B invoices in Germany are:

- Since 1 January 2025, every business must be able to **receive** an e-invoice.
- The duty to **issue** one is phased in: the transition rules end for businesses with a prior-year
  turnover above €800,000 on 1 January 2027, and for everyone else on 1 January 2028.

Sources: [IHK Stuttgart](https://www.ihk.de/stuttgart/fuer-unternehmen/recht-und-steuern/steuerrecht/steuermeldungen/e-rechnung-5864496)
and [Haufe](https://www.haufe.de/wissen/finance/e-rechnung). Check the current BMF letter for the
details; this project follows the BMF letter of 15 October 2024.

XRechnung is one valid format, not the only one: a Factur-X/ZUGFeRD file with the `EN16931` profile
is valid too. See "Which format should I use?" below.

### I use the Kleinunternehmerregelung (§19 UStG). Do I have to send e-invoices?

Under the current rules, §19 businesses are exempt from the duty to **issue** e-invoices, but they
still have to be able to **receive** them (see the IHK pages linked above). Nothing stops you from
sending one anyway; some customers will ask for it. §34a UStDV, the rule on invoices from §19
businesses, also says such an invoice may always be sent as an ordinary invoice
(_sonstige Rechnung_). Ask your tax advisor if you are unsure.

### Does the library check that I really qualify for §19?

No. It checks that a seller tax ID is present and that the exemption wording is accepted. It does not
check the €25,000 / €100,000 turnover thresholds or a waiver under §19 Abs. 3. See
[`LIMITATIONS.md`](LIMITATIONS.md).

### Does the library tell me which VAT treatment to use?

No. You choose the VAT category and rate, and the library checks that the invoice is consistent and
that the required wording is there. For example, a reverse-charge tag is necessary but not sufficient
proof that §13b applies. See the "Partially supported" table in
[`SUPPORTED_SCENARIOS.md`](SUPPORTED_SCENARIOS.md).

### Can I still send a normal PDF invoice?

Yes, in some situations:

- **2025–2026:** Businesses can generally keep sending ordinary PDF invoices with the recipient's
  consent.
- **2027:** Businesses with a previous-year turnover of €800,000 or less can generally keep using
  ordinary PDFs with the recipient's consent.
- **From 2028:** Covered domestic B2B transactions generally require structured e-invoices, unless an
  exception applies.

An ordinary PDF is not a structured e-invoice. It counts as an _other invoice_ (_sonstige Rechnung_).

### Do I need an e-invoice for amounts under €250?

Not always. An invoice with a total of **€250 or less, including VAT**, generally qualifies as a
small-amount invoice (_Kleinbetragsrechnung_) under §33 UStDV. That includes an invoice of exactly
€250. It may always be sent as an ordinary invoice (_sonstige Rechnung_), even after 1 January 2028.

The simplified rules do not apply to every transaction. §33 UStDV excludes invoices covering
supplies under §3c, §6a and §13b UStG, which includes reverse-charge transactions under §13b.

Source: [§33 UStDV](https://www.gesetze-im-internet.de/ustdv_1980/__33.html).

### Do I need an e-invoice when selling to a private customer?

No. Germany's mandatory domestic B2B e-invoicing rules do not apply to sales to private consumers
(B2C). You can keep issuing ordinary invoices to private customers, subject to the other invoicing
rules.

### Do I need an e-invoice for a customer outside Germany?

The German domestic B2B mandate generally applies to transactions between businesses established in
Germany. Invoices to customers outside Germany are not automatically covered. Other countries may
have their own e-invoicing requirements, which this library does not check.

### Do I have to keep electronic invoices?

Yes. German VAT rules generally require invoices to be kept for eight years. For an e-invoice, at
least the original structured data must be kept without alteration; a printout or a visual PDF
representation alone is not enough.

OpenInvoiceXML generates and validates invoice files. It does not provide an invoice archiving
system.

## Choosing a format

### Which format should I use?

| Your recipient asks for                    | Use                                                                |
| ------------------------------------------ | ------------------------------------------------------------------ |
| XRechnung (public sector, many companies)  | `generateInvoice()` for the XML                                    |
| A readable PDF that also contains the data | `generateHybridPdf()` (XRechnung inside) or `generateFacturXPdf()` |
| ZUGFeRD / Factur-X                         | `generateFacturXPdf()` with the `EN16931` profile                  |

Not sure? Ask the recipient. A plain PDF without embedded data is not an e-invoice.

### Why is the hybrid PDF not a ZUGFeRD file?

`generateHybridPdf()` embeds the XRechnung UBL file. ZUGFeRD and Factur-X need CII XML inside the PDF,
which is what `generateFacturXPdf()` embeds. See
[`SUPPORTED_SCENARIOS.md`](SUPPORTED_SCENARIOS.md#output-formats).

### Why are the ZUGFeRD profiles MINIMUM, BASIC WL and BASIC missing?

MINIMUM and BASIC WL have no invoice lines, so they are not valid e-invoices in Germany (BMF letter of
15 October 2024). BASIC is valid but is a smaller version of `EN16931`, which is supported. Details in
[`LIMITATIONS.md`](LIMITATIONS.md).

## Using the library

### Does it support my kind of invoice?

Look it up in [`SUPPORTED_SCENARIOS.md`](SUPPORTED_SCENARIOS.md). It lists every supported scenario
with the test invoice that proves it, the ones with caveats, and the ones that are not supported. That
page is the single source of truth, so this FAQ does not repeat it.

### Does it calculate my totals?

No. Every total must match the lines to the cent. A mismatch comes back as an issue instead of silently
corrected XML. See [`EXAMPLES.md`](EXAMPLES.md).

### I have no VAT ID. What do I put as the seller ID?

Put your Steuernummer in `taxRegistrationId`, and also in `identifier`. The standard needs a seller
identifier, and the Steuernummer in `taxRegistrationId` alone does not count; without it you get
`SELLER_IDENTIFIER_REQUIRED`. The worked case is in [`EXAMPLES.md`](EXAMPLES.md), and the field
mapping is in [`DATA-MODEL.md`](DATA-MODEL.md).

### Do I need a Leitweg-ID for every XRechnung?

No. A Leitweg-ID is generally used when invoicing German public authorities. For business-to-business
invoices, the buyer reference (BT-10) can hold an identifier your customer gave you, such as an
internal reference, a cost centre or an order number. The BMF's e-invoicing FAQ says a Leitweg-ID is
generally not needed between businesses.

XRechnung still requires BT-10 to be present, and so does this library for the `XRECHNUNG` profile
(`BT-10` is checked for presence, not for format). Ask your customer what they want in it; their
system may require something specific. Do not invent a placeholder without checking with them.

### Does the library send the invoice for me?

No. It creates and checks the XML or PDF file. How the file reaches your customer (e-mail, a portal or
a network) is up to you and the recipient.

### Does my invoice data leave my computer?

The library runs where you run it, in Node.js or in the browser, and the generation and checking
steps need no online service. The optional official validator (KoSIT) is downloaded once by
`make kosit-setup` and then runs locally with Java.

## When something goes wrong

### The result has `xml: null` or `pdf: null`. What now?

At least one issue has the severity `error`, so nothing was generated on purpose. Read `issues`:
each one has a `code` and a message, and the code tells you which field to fix. Warnings do not block
the output but are worth reading. Do not send an invoice that did not generate.

### What does it mean when KoSIT rejects my invoice?

KoSIT is the official German validator. OpenInvoiceXML's own checks do not cover everything it
checks, so an invoice can pass locally and still be rejected by KoSIT. Known examples: missing
payment means (`BR-DE-1`), a missing due date on an invoice that is owed (`BR-CO-25`), and a
`deliverTo` address without city or postal code. The full list is in
[`LIMITATIONS.md`](LIMITATIONS.md).

Run the external check before you send, with `generateInvoice(invoice, { validateExternally: true })`
after `make kosit-setup`, or call `validateXmlExternally()` on existing XML. The setup is described in
[`COMPLIANCE.md`](COMPLIANCE.md).

### Can I check an invoice file that another program made?

Yes, in Node.js with `validateFileExternally()`. It runs KoSIT, Mustang and veraPDF as they apply. It
cannot run OpenInvoiceXML's own business rules on it, and it needs Java.

### A "pass" came back. Is my invoice correct?

It means the invoice passed the checks that ran. It does not show that the amounts, the VAT treatment
or the customer's accounting system are right. Your tax advisor and the recipient have the final say.
