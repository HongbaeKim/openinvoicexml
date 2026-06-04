// Output adapters transform a normalized Invoice into a specific format.
// Each adapter is independent — adding or replacing one never touches the others.
//
// Planned adapters:
//   XRechnungAdapter  → UBL 2.1 XML (Phase 2)
//   PdfAdapter        → PDF/A-3 hybrid with embedded XML (Phase 4)
