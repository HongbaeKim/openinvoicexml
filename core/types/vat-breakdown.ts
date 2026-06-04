/**
 * VAT category codes allowed by EN 16931 / XRechnung (subset of UNTDID 5305).
 * Note: "AA" (reduced rate) exists in UNTDID 5305 but is NOT valid in XRechnung —
 * both 19% and 7% German rates use "S"; the actual rate lives in BT-119/BT-152.
 *
 * S  = Standard rate (covers all positive rates incl. 7% reduced)
 * Z  = Zero rated
 * E  = Exempt
 * AE = Reverse charge (§13b UStG)
 * K  = Intra-community supply (zero-rated, EU cross-border)
 * G  = Export outside EU (zero-rated)
 * O  = Not subject to VAT (§19 Kleinunternehmerregelung)
 */
export type VatCategoryCode = "S" | "Z" | "E" | "AE" | "K" | "G" | "O";

/** BG-23: VAT breakdown for one tax category on the invoice. */
export interface VatBreakdown {
  /** BT-118: VAT category code. */
  categoryCode: VatCategoryCode;
  /** BT-119: VAT category rate as a percentage. */
  rate: number;
  /** BT-116: Sum of taxable amounts for this category. */
  taxableAmount: number;
  /** BT-117: VAT amount for this category. */
  taxAmount: number;
  /** BT-120: Exemption reason text (required when rate is 0 or category is E/AE/K/G/O). */
  exemptionReason?: string;
  /** BT-121: Exemption reason code (VATEX code list). */
  exemptionReasonCode?: string;
}
