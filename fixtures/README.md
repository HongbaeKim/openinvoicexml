# Fixtures

JSON invoice examples used for development, testing, and documentation.

Each fixture is a valid `Invoice` object (see `core/types/invoice.ts`) and has a corresponding
expected XRechnung XML output once Phase 2 is complete.

| File                               | Scenario                                 | Status      |
| ---------------------------------- | ---------------------------------------- | ----------- |
| `domestic-simple.invoice.json`     | Standard 19% VAT                         | Implemented |
| `domestic-multi-line.invoice.json` | Multiple lines, standard VAT             | Implemented |
| `reduced-rate.invoice.json`        | Reduced 7% VAT (category S)              | Implemented |
| `exempt.invoice.json`              | VAT-exempt (category E, §4 UStG)         | Implemented |
| `zero-rated.invoice.json`          | Zero-rated (category Z)                  | Implemented |
| `reverse-charge.invoice.json`      | Reverse charge / §13b UStG (category AE) | Implemented |
