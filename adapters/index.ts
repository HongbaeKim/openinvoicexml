// Output adapters transform a normalized Invoice into a specific format.
// Each adapter is independent — adding or replacing one never touches the others.
//
// Adapters:

// XRechnungAdapter  → UBL 2.1 XML

// CiiAdapter → creates CII XML for EN16931 or XRechnung.
//              Factur-X/ZUGFeRD requires CII XML, not UBL.

// PdfAdapter → creates two types of hybrid PDFs using the same PDF layout:
//
//              toHybridPdf() embeds UBL XML.
//              It is a hybrid PDF, but not an official Factur-X/ZUGFeRD PDF.
//
//              toFacturXPdf() embeds CII XML using embedFacturX().
//              It creates a real Factur-X/ZUGFeRD PDF and adds the correct
//              Factur-X metadata for the selected profile.

export { toXRechnung } from "./xrechnung.js";
export { toCii } from "./cii.js";
export { toHybridPdf, toFacturXPdf, extractEmbeddedXml } from "./hybrid-pdf.js";
export type { EInvoiceProfile, HybridPdfOptions } from "./hybrid-pdf.js";

export {
  generateInvoice,
  generateHybridPdf,
  generateFacturXPdf,
  generateCii,
  generateInvoiceDocument,
} from "./generate-invoice.js";
export type {
  GenerateInvoiceResult,
  GenerateHybridPdfResult,
  GenerateFacturXPdfResult,
  GenerateCiiResult,
  InvoiceOutputFormat,
  GenerateInvoiceDocumentOptions,
  GenerateInvoiceDocumentResult,
} from "./generate-invoice.js";
