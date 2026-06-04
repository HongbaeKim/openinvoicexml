import type { InvoiceLine } from "./invoice-line.js";
import type { Party } from "./party.js";
import type { VatBreakdown } from "./vat-breakdown.js";

/** Document type codes per EN 16931 / XRechnung. */
export type InvoiceTypeCode =
  | "380" // Commercial invoice
  | "381" // Credit note
  | "384"; // Corrective invoice

/**
 * Internal invoice schema — the single source of truth for all output adapters.
 * Every field maps to one or more XRechnung Business Terms (BT/BG).
 * See SCHEMA.md for the full BT mapping table.
 */
export interface Invoice {
  /** BT-1: Invoice number — unique identifier assigned by the seller. */
  id: string;
  /** BT-3: Invoice type code. */
  typeCode: InvoiceTypeCode;
  /** BT-2: Invoice issue date in YYYY-MM-DD format. */
  issueDate: string;
  /** BT-9: Payment due date in YYYY-MM-DD format. */
  dueDate?: string;

  /** BG-4: Seller (invoicing party). */
  seller: Party;
  /** BG-7: Buyer (invoiced party). */
  buyer: Party;

  /** BG-25: Invoice lines. */
  lines: InvoiceLine[];
  /** BG-23: VAT breakdown by tax category. */
  vatBreakdowns: VatBreakdown[];

  /** BT-109: Invoice total amount without VAT. */
  taxExclusiveAmount: number;
  /** BT-110: Total VAT amount. */
  taxAmount: number;
  /** BT-112: Invoice total amount with VAT. */
  taxInclusiveAmount: number;
  /** BT-115: Amount due for payment. */
  duePayableAmount: number;

  /** BT-22: Note / free-text remark on the invoice. */
  note?: string;
  /** BT-10: Buyer reference (Leitweg-ID for German public sector). */
  buyerReference?: string;
  /** BT-12: Contract reference. */
  contractReference?: string;
  /** BT-13: Purchase order reference. */
  purchaseOrderReference?: string;

  /** BT-25 / BT-26: Reference to a preceding invoice (for credit notes / corrections). */
  precedingInvoiceReference?: {
    id: string;
    issueDate: string;
  };
}
