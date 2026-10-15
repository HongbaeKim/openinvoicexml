# Performance

Measured baselines for the generation pipeline. Reproduce with `make benchmark` (engine timing
and batch) and `make benchmark-validate` (external-validator correctness at scale). Both are
manual checks, not part of CI.

## Reference environment

|           |                                     |
| --------- | ----------------------------------- |
| Node      | v20.19.6                            |
| OS / arch | Linux x64                           |
| CPU       | 4× Intel Xeon E5-2680 v4 @ 2.40 GHz |
| RAM       | 4 GB                                |
| Date      | 2026-10-14                          |

Numbers are for this (modest, shared-VM-class) machine. Treat them as an order-of-magnitude
reference, not a guarantee; re-run `make benchmark` on your own hardware.

## Methodology

- Engine timing (schema validation, business rules, `toXRechnung()`, `toHybridPdf()`) is kept
  **separate** from the external validators (KoSIT, Mustang, veraPDF). Their JVM startup would
  swamp generation cost, so they get a pass/fail correctness check at scale and their cost is
  listed on its own below.
- `scripts/benchmark.ts` has three separate parts: `stress()` times individual engine stages at
  100/500/1000 lines; `batch()` generates 100 realistic-sized invoices and checks memory growth;
  `validateExternal()` is an optional, untimed large-document correctness check that does not
  replace the normal fixture validation suite. `make benchmark` runs the first two,
  `make benchmark-validate` runs only the third.
- Each stage gets one untimed warm-up, then 5 timed iterations; **median (min–max)** reported.
- Invoices are generated programmatically by `scripts/benchmark.ts` (one 19 % VAT breakdown,
  deterministic prices), not stored as fixtures.
- Memory is sampled right after each timed iteration (and after each batch invoice); the highest sample is shown. This is not continuous monitoring, so brief higher peaks during rendering may not be captured. `external` matters
  because PDF libraries allocate outside the V8 heap.

## Engine stress results

Wall-clock, ms — median (min–max):

| Stage             | 100 lines     | 500 lines        | 1000 lines       |
| ----------------- | ------------- | ---------------- | ---------------- |
| Schema validation | 0.4 (0.3–0.6) | 0.8 (0.7–0.9)    | 1.0 (0.7–1.5)    |
| Business rules    | 0.1 (0.1–0.2) | 0.4 (0.3–0.6)    | 0.5 (0.5–0.8)    |
| `toXRechnung()`   | 0.6 (0.5–3.4) | 2.5 (2.0–2.9)    | 4.8 (3.6–6.6)    |
| `toHybridPdf()`   | 284 (271–329) | 1066 (1022–1085) | 2013 (2004–2059) |

Highest post-iteration memory sample during `toHybridPdf()`:

| Lines | heapUsed | rss    | external |
| ----- | -------- | ------ | -------- |
| 100   | 34 MB    | 133 MB | 11 MB    |
| 500   | 65 MB    | 167 MB | 21 MB    |
| 1000  | 118 MB   | 234 MB | 31 MB    |

Findings:

- PDF rendering is ~99.7 % of generation time at every size; XML generation and validation are
  negligible (single-digit ms even at 1000 lines).
- PDF cost scales approximately linearly over the tested range (~2 ms per additional line item); no problematic super-linear behaviour was observed up to 1000 lines.
- The roadmap hypothesis "100-line invoice in under 2 s" holds with wide margin: 0.28 s for the
  PDF, under 2 ms for XML only.

## Baseline targets

Set with headroom over the measured values on the reference environment:

| Stage                                     | 100 lines | 500 lines | 1000 lines |
| ----------------------------------------- | --------- | --------- | ---------- |
| Schema + business rules + `toXRechnung()` | < 50 ms   | < 100 ms  | < 200 ms   |
| `toHybridPdf()`                           | < 1 s     | < 3 s     | < 5 s      |
| `toHybridPdf()` post-iteration rss        | < 250 MB  | < 300 MB  | < 400 MB   |

## Batch generation

100 distinct invoices (5–24 lines each), sequentially through `generateHybridPdf()`, one
untimed warm-up, `global.gc()` only at 10-invoice boundaries:

|                  |                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------ |
| Total time       | 9.7 s (≈ 97 ms / invoice)                                                            |
| Highest sample   | heapUsed 132 MB, rss 263 MB, external 31 MB                                          |
| Post-GC heapUsed | 19.0 → 19.2 MB across 10 baselines (+0.7 %)                                          |
| Leak check       | **No leak**: post-GC baseline is flat; `external` oscillates (7–20 MB) without trend |

## Concurrent use

Browser generation runs on the user's device and therefore does not share server capacity between users. When using the Node.js API inside a server, PDF generation is CPU-bound and consumers should benchmark concurrency for their own deployment and apply appropriate request/input limits.

## External validators

Not part of generation targets. Each is a separate JVM process with a large fixed startup and
schema-loading cost, plus a smaller size-dependent part (single file per invocation, one run
each, so indicative only):

| Tool          | 100 lines | 1000 lines |
| ------------- | --------- | ---------- |
| KoSIT (XML)   | 9.7 s     | 10.9 s     |
| Mustang (XML) | 4.0 s     | 7.6 s      |
| veraPDF (PDF) | 2.1 s     | 4.2 s      |

Fixed cost dominates, so pass many files to one invocation (the runners accept arrays) rather
than one JVM per file.

Correctness at scale (`make benchmark-validate`, 2026-10-14): at 100, 500 and 1000 lines, KoSIT
and Mustang pass on the XML; veraPDF passes on the hybrid PDF; the embedded XML is byte-identical
to `toXRechnung()` and passes KoSIT and Mustang. Pagination holds up cleanly at 1000 lines.

## Profile (1000 lines, `node --cpu-prof`)

Reproduce: `node --cpu-prof dist/scripts/benchmark.js --lines 1000 --iterations 3 --skip-batch`.

Top self-time, roughly:

- fontkit text shaping/layout (`applyLookups`, `assignGlobalFeatures`, `applyLookup`,
  `applyChainingContext`, `setup`, …): the largest group, about 35–40 % combined.
- `Intl.NumberFormat` construction in `formatAmountDE` / `formatUnitPriceDE`: ~9 %. A new
  formatter is built on every call.
- pdf-lib validators / number serialization: ~4–5 %.
- GC: ~3 %.
- `business-rules.ts`'s per-breakdown `lines.filter(...)` did **not** appear in the profile
  (0.5 ms at 1000 lines).

## Optimization decisions

No code was changed this week. Every measured figure is far inside the targets above, and the
roadmap says not to over-optimize.

Found and deferred:

- **Cache `Intl.NumberFormat` instances in `core/utils/format-de.ts`** (keyed by currency).
  Would save roughly 9 % of PDF time; trivial and safe, but not needed to meet any target.
  Do it if PDF throughput becomes a requirement.
- **Text shaping in fontkit**: inherent to embedding fonts via pdf-lib; no cheap fix without
  changing the PDF stack. Not pursued.
