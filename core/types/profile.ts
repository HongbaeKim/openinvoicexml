/**
 * Which e-invoice conformance profile is claimed: plain EN 16931, or Germany's XRechnung CIUS
 * (which adds mandatory fields and BR-DE-* rules on top of EN 16931 — see docs/COMPLIANCE.md).
 */
export type EInvoiceProfile = "XRECHNUNG" | "EN16931";
