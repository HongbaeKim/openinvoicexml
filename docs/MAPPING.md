# XRechnung Business Term Mapping

Maps XRechnung 3.x Business Terms (BT/BG) to their corresponding fields in the internal
Invoice schema and to the UBL 2.1 XML element they produce.

## Document level (BG-2)

| BT    | Name                      | Internal field          | UBL element                    |
|-------|---------------------------|-------------------------|--------------------------------|
| BT-24 | Specification identifier  | (hardcoded)             | `cbc:CustomizationID`          |
| BT-23 | Business process type     | `businessProcessType`   | `cbc:ProfileID`                |
| BT-1  | Invoice number            | `id`                    | `cbc:ID`                       |
| BT-2  | Issue date                | `issueDate`             | `cbc:IssueDate`                |
| BT-3  | Invoice type code         | `typeCode`              | `cbc:InvoiceTypeCode`          |
| BT-22 | Note                      | `note` (optional)       | `cbc:Note`                     |
| BT-5  | Document currency code    | `currencyCode`          | `cbc:DocumentCurrencyCode`     |
| BT-10 | Buyer reference           | `buyerReference` (opt.) | `cbc:BuyerReference`           |
| BT-9  | Payment due date          | `dueDate` (optional)    | `cac:PaymentTerms/cbc:Note`    |

## Seller (BG-4)

| BT    | Name                      | Internal field                           | UBL element                                                     |
|-------|---------------------------|------------------------------------------|-----------------------------------------------------------------|
| BT-34 | Seller electronic address | `seller.electronicAddress`               | `cbc:EndpointID`                                               |
| BT-34 | Electronic address scheme | `seller.electronicAddressSchemeId`       | `cbc:EndpointID[@schemeID]` (default `"EM"`)                   |
| BT-27 | Seller name               | `seller.name`                            | `cac:PartyName/cbc:Name`                                       |
| BT-35 | Seller address line 1     | `seller.address.line1`                   | `cbc:StreetName`                                               |
| BT-36 | Seller address line 2     | `seller.address.line2` (optional)        | `cbc:AdditionalStreetName`                                     |
| BT-37 | Seller city               | `seller.address.city`                    | `cbc:CityName`                                                 |
| BT-38 | Seller postal code        | `seller.address.postalCode`              | `cbc:PostalZone`                                               |
| BT-40 | Seller country code       | `seller.address.countryCode`             | `cac:Country/cbc:IdentificationCode`                           |
| BT-31 | Seller VAT identifier     | `seller.vatId` (optional)                | `cac:PartyTaxScheme/cbc:CompanyID` (TaxScheme `VAT`)           |
| BT-32 | Seller tax registration   | `seller.taxRegistrationId` (optional)    | `cac:PartyTaxScheme/cbc:CompanyID` (TaxScheme `FC`)            |
| BT-30 | Seller legal registration | `seller.legalId` (opt., fallback: name)  | `cac:PartyLegalEntity/cbc:CompanyID`                           |
| BT-28 | Seller legal name         | `seller.name`                            | `cac:PartyLegalEntity/cbc:RegistrationName`                    |
| BT-41 | Seller contact point      | `seller.contact.name` (optional)         | `cac:Contact/cbc:Name`                                         |
| BT-42 | Seller contact telephone  | `seller.contact.telephone`               | `cac:Contact/cbc:Telephone`                                    |
| BT-43 | Seller contact email      | `seller.contact.email`                   | `cac:Contact/cbc:ElectronicMail`                                |

Seller contact (BG-6) is mandatory under the XRechnung national extension rule `BR-DE-2` —
enforced structurally: the JSON Schema requires `seller.contact` (see `schemas/invoice.schema.json`).
`Party.contact` is defined once and shared with `buyer` (EN 16931 BG-9), but only the seller's
is required.

## Buyer (BG-7)

Buyer follows the same structure as seller. BT numbers shift to the BG-7 range.

| BT    | Name                      | Internal field                           | UBL element                                                     |
|-------|---------------------------|------------------------------------------|-----------------------------------------------------------------|
| BT-49 | Buyer electronic address  | `buyer.electronicAddress`                | `cbc:EndpointID`                                               |
| BT-49 | Electronic address scheme | `buyer.electronicAddressSchemeId`        | `cbc:EndpointID[@schemeID]` (default `"EM"`)                   |
| BT-44 | Buyer name                | `buyer.name`                             | `cac:PartyName/cbc:Name`                                       |
| BT-50 | Buyer address line 1      | `buyer.address.line1`                    | `cbc:StreetName`                                               |
| BT-51 | Buyer address line 2      | `buyer.address.line2` (optional)         | `cbc:AdditionalStreetName`                                     |
| BT-52 | Buyer city                | `buyer.address.city`                     | `cbc:CityName`                                                 |
| BT-53 | Buyer postal code         | `buyer.address.postalCode`               | `cbc:PostalZone`                                               |
| BT-55 | Buyer country code        | `buyer.address.countryCode`              | `cac:Country/cbc:IdentificationCode`                           |
| BT-48 | Buyer VAT identifier      | `buyer.vatId` (optional)                 | `cac:PartyTaxScheme/cbc:CompanyID` (TaxScheme `VAT`)           |
| BT-47 | Buyer legal registration  | `buyer.legalId` (opt., fallback: name)   | `cac:PartyLegalEntity/cbc:CompanyID`                           |
| BT-45 | Buyer legal name          | `buyer.name`                             | `cac:PartyLegalEntity/cbc:RegistrationName`                    |

## Payment means (BG-16)

Emitted only when `paymentMeans` is present.

| BT    | Name                      | Internal field                 | UBL element                                              |
|-------|---------------------------|--------------------------------|----------------------------------------------------------|
| BT-81 | Payment means code        | `paymentMeans.code`            | `cbc:PaymentMeansCode`                                   |
| BT-84 | Payment account ID (IBAN) | `paymentMeans.iban` (optional) | `cac:PayeeFinancialAccount/cbc:ID`                       |
| BT-85 | Payment account name      | `paymentMeans.accountName` (optional) | `cac:PayeeFinancialAccount/cbc:Name`              |
| BT-86 | Payment service provider  | `paymentMeans.bic` (optional)  | `cac:PayeeFinancialAccount/cac:FinancialInstitutionBranch/cbc:ID` |

## VAT breakdown (BG-23)

One `cac:TaxSubtotal` per entry in `vatBreakdowns`.

| BT     | Name                    | Internal field                     | UBL element                          |
|--------|-------------------------|------------------------------------|--------------------------------------|
| BT-116 | VAT taxable amount      | `vatBreakdowns[i].taxableAmount`   | `cbc:TaxableAmount[@currencyID]`     |
| BT-117 | VAT amount              | `vatBreakdowns[i].taxAmount`       | `cbc:TaxAmount[@currencyID]`         |
| BT-118 | VAT category code       | `vatBreakdowns[i].categoryCode`    | `cac:TaxCategory/cbc:ID`             |
| BT-119 | VAT category rate       | `vatBreakdowns[i].rate`            | `cac:TaxCategory/cbc:Percent`        |
| BT-120 | Exemption reason        | `vatBreakdowns[i].exemptionReason` (optional) | `cbc:TaxExemptionReason`  |
| BT-121 | Exemption reason code   | `vatBreakdowns[i].exemptionReasonCode` (optional) | `cbc:TaxExemptionReasonCode` |

## Document totals (BG-22)

| BT     | Name                        | Internal field / derivation                      | UBL element                                |
|--------|-----------------------------|--------------------------------------------------|--------------------------------------------|
| BT-106 | Sum of line net amounts     | `sum(lines[i].lineAmount)`                       | `cbc:LineExtensionAmount[@currencyID]`     |
| BT-109 | Invoice total excl. VAT     | `taxExclusiveAmount`                             | `cbc:TaxExclusiveAmount[@currencyID]`      |
| BT-110 | Total VAT amount            | `taxAmount`                                      | `cbc:TaxAmount[@currencyID]` (in TaxTotal) |
| BT-112 | Invoice total incl. VAT     | `taxInclusiveAmount`                             | `cbc:TaxInclusiveAmount[@currencyID]`      |
| BT-115 | Amount due for payment      | `duePayableAmount`                               | `cbc:PayableAmount[@currencyID]`           |

## Invoice lines (BG-25)

One `cac:InvoiceLine` per entry in `lines`.

| BT     | Name                  | Internal field           | UBL element                                           |
|--------|-----------------------|--------------------------|-------------------------------------------------------|
| BT-126 | Line identifier       | `lines[i].id`            | `cbc:ID`                                              |
| BT-129 | Invoiced quantity     | `lines[i].quantity`      | `cbc:InvoicedQuantity`                                |
| BT-130 | Unit of measure code  | `lines[i].unitCode`      | `cbc:InvoicedQuantity[@unitCode]`                     |
| BT-131 | Line net amount       | `lines[i].lineAmount`    | `cbc:LineExtensionAmount[@currencyID]`                |
| BT-153 | Item name             | `lines[i].name`          | `cac:Item/cbc:Name`                                   |
| BT-154 | Item description      | `lines[i].description` (optional) | `cac:Item/cbc:Description`               |
| BT-151 | Line VAT category     | `lines[i].vatCategoryCode` | `cac:Item/cac:ClassifiedTaxCategory/cbc:ID`         |
| BT-152 | Line VAT rate         | `lines[i].vatRate`       | `cac:Item/cac:ClassifiedTaxCategory/cbc:Percent`      |
| BT-146 | Item net price        | `lines[i].unitPrice`     | `cac:Price/cbc:PriceAmount[@currencyID]`              |

## Not yet mapped (deferred to Phase 3+)

- **BT-11**: Project reference
- **BT-12**: Contract reference (`contractReference` exists in schema but not emitted as a BT-12 element yet)
- **BT-13**: Purchase order reference (`purchaseOrderReference` exists in schema but not emitted yet)
- **BT-17**: Tender or lot reference
- **BT-25 / BT-26**: Preceding invoice reference (`precedingInvoiceReference` exists in schema but not emitted yet)
- **BG-24**: Additional supporting documents
- **BG-20 / BG-21**: Document-level allowances and charges
- **BG-27 / BG-28**: Line-level allowances and charges
- **BT-113**: Prepaid amount
