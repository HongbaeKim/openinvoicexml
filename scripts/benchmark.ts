// Performance benchmark — see docs/PERFORMANCE.md for the methodology and recorded numbers.
//
// Engine generation timing (schema, business rules, toXRechnung, toHybridPdf) is kept strictly
// separate from the external validators (KoSIT/Mustang/veraPDF): their JVM startup would swamp
// the numbers, so they only get a pass/fail correctness check (--validate-external).
//
// Usage (after `npm run build`, via `make benchmark`):
//   node --expose-gc dist/scripts/benchmark.js [--lines 100,500,1000] [--iterations 5]
//        [--batch-size 100] [--skip-stress] [--skip-batch] [--validate-external]
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { arch, cpus, platform, totalmem } from "node:os";
import type { Invoice, InvoiceLine } from "../core/index.js";
import {
  toXRechnung,
  toHybridPdf,
  extractEmbeddedXml,
  generateHybridPdf,
} from "../adapters/index.js";
import {
  validateInvoiceSchema,
  validateBusinessRules,
  runKosit,
  runMustang,
  runVeraPdf,
} from "../validators/index.js";

const TODAY = "2026-10-14"; // fixed so business-rule results are deterministic

// ---------- synthetic invoices ----------

/** Integer-cent arithmetic so every generated invoice passes BR-CO-* rounding rules. */
function eur(cents: number): number {
  return cents / 100;
}

/**
 * Valid XRechnung invoice with `lineCount` lines, one 19% VAT breakdown. `seed` varies prices
 * and quantities so batch runs are distinct documents, not copies.
 */
export function buildInvoice(lineCount: number, seed = 0): Invoice {
  const lines: InvoiceLine[] = [];
  let netCents = 0;
  for (let i = 1; i <= lineCount; i++) {
    const quantity = 1 + ((i + seed) % 5);
    const unitCents = 1000 + ((i * 37 + seed * 11) % 9000);
    const amountCents = quantity * unitCents;
    netCents += amountCents;
    lines.push({
      id: String(i),
      name: `Beratungsleistung ${i}`,
      description: `Position ${i} der Sammelrechnung ${seed}`,
      quantity,
      unitCode: "HUR",
      unitPrice: eur(unitCents),
      lineAmount: eur(amountCents),
      vatCategoryCode: "S",
      vatRate: 19,
    });
  }
  const taxCents = Math.round(netCents * 0.19);
  return {
    id: `BENCH-${lineCount}-${seed}`,
    typeCode: "380",
    issueDate: "2026-09-14",
    dueDate: "2026-10-14",
    currencyCode: "EUR",
    businessProcessType: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
    buyerReference: "04011000-99999-14",
    seller: {
      name: "Max Mustermann GmbH",
      vatId: "DE123456789",
      address: {
        line1: "Unter den Linden 1",
        city: "Berlin",
        postalCode: "10117",
        countryCode: "DE",
      },
      electronicAddress: "rechnung@mustermann.example",
      electronicAddressSchemeId: "EM",
      contact: {
        name: "Buchhaltung",
        telephone: "+49 30 1234567",
        email: "buchhaltung@mustermann.example",
      },
    },
    buyer: {
      name: "Benchmark Kunde AG",
      vatId: "DE987654321",
      address: {
        line1: "Marienplatz 1",
        city: "München",
        postalCode: "80331",
        countryCode: "DE",
      },
      electronicAddress: "einkauf@kunde.example",
      electronicAddressSchemeId: "EM",
    },
    lines,
    vatBreakdowns: [
      { categoryCode: "S", rate: 19, taxableAmount: eur(netCents), taxAmount: eur(taxCents) },
    ],
    taxExclusiveAmount: eur(netCents),
    taxAmount: eur(taxCents),
    taxInclusiveAmount: eur(netCents + taxCents),
    duePayableAmount: eur(netCents + taxCents),
    paymentMeans: { code: "58", iban: "DE89370400440532013000", bic: "COBADEFFXXX" },
  };
}


/**
 * Stores timing statistics in milliseconds.
 *
 * median: middle execution time (typical performance)
 * min: fastest execution time
 * max: slowest execution time
 */
interface Stats {
  median: number;
  min: number;
  max: number;
}

/**
 * Calculate timing statistics from multiple test runs.
 *
 * Example:
 * samples = [120, 100, 150, 110, 130]
 * sorted  = [100, 110, 120, 130, 150]
 *
 * Result: median = 120, min = 100, max = 150
 */
function stats(samples: number[]): Stats {
  // Copy the array and sort from smallest to largest.
  // [...samples] prevents changing the original array.
  const sorted = [...samples].sort((a, b) => a - b);

  // Find the middle index.
  const mid = Math.floor(sorted.length / 2);

  // Odd count: use the middle number.
  // Even count: average the two middle numbers.
  const median =
    sorted.length % 2 === 1
      ? (sorted[mid] as number)
      : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;

  // Return the middle, smallest, and largest values.
  return {
    median,
    min: sorted[0] as number,
    max: sorted[sorted.length - 1] as number,
  };
}

/**
 * Stores three types of Node.js memory usage.
 *
 * heapUsed: Are my JS objects growing?
 * 
 * rss(Resident Set Size): How much total RAM is my Node process consuming?
 * 
 * external: Are PDF/binary/native allocations growing?
 *
 * All values are measured in bytes.
 */
interface Mem {
  heapUsed: number;
  rss: number;
  external: number;
}

/**
 * Get the current memory usage of the Node.js process.
 */
function mem(): Mem {
  // Ask Node.js how much memory it is using.
  const m = process.memoryUsage();

  // Return only the three memory values we want.
  return {
    heapUsed: m.heapUsed,
    rss: m.rss,
    external: m.external,
  };
}

/**
 * Compare two memory measurements.
 *
 * Keep the highest value for each memory category.
 * Useful for tracking memory usage during benchmarks.
 *
 * Note: the highest values may come from different moments.
 */
function peak(a: Mem, b: Mem): Mem {
  return {
    heapUsed: Math.max(a.heapUsed, b.heapUsed),
    rss: Math.max(a.rss, b.rss),
    external: Math.max(a.external, b.external),
  };
}

// Convert bytes into megabytes with one decimal place.
// Example: 10485760 bytes -> "10.0"
const mb = (n: number): string =>
  (n / 1024 / 1024).toFixed(1);

// Format memory measurements into readable text.
const fmtMem = (m: Mem): string =>
  `heapUsed ${mb(m.heapUsed)} MB, rss ${mb(m.rss)} MB, external ${mb(m.external)} MB`;

// Format timing results into readable text.
// Example: median 120.0 ms (min 100.0, max 150.0)
const fmtStats = (s: Stats): string =>
  `median ${s.median.toFixed(1)} ms (min ${s.min.toFixed(1)}, max ${s.max.toFixed(1)})`;

/**
 * Result of benchmarking one operation.
 *
 * stats: execution time statistics
 * peakMem: highest memory readings collected during the test
 */
interface StageResult {
  stats: Stats;

  // Memory is sampled after each iteration.
  // This does not capture temporary peaks during execution.
  peakMem: Mem;
}

/**
 * Measure how long an operation takes.
 *
 * 1. Run once without timing (warm-up).
 * 2. Run multiple timed iterations.
 * 3. Record execution time and memory usage.
 * 4. Return timing statistics and highest memory readings.
 *
 * Example:
 * measureStage(5, () => toHybridPdf(invoice))
 */
async function measureStage(
  iterations: number,
  run: () => unknown,
): Promise<StageResult> {

  // Warm-up run (not measured).
  // Helps initialize modules, fonts, and JIT optimization.
  await run();

  // Store execution times from each iteration.
  const samples: number[] = [];

  // Start with the current memory measurement.
  let peakMem = mem();

  // Run the same operation multiple times.
  for (let i = 0; i < iterations; i++) {

    // Record starting time.
    const t0 = performance.now();

    // Execute the operation and wait until it finishes.
    await run();

    // Calculate elapsed time in milliseconds.
    samples.push(performance.now() - t0);

    // Update the highest observed memory values.
    peakMem = peak(peakMem, mem());
  }

  // Return timing statistics and memory results.
  return {
    stats: stats(samples),
    peakMem,
  };
}

/**
 * Read benchmark options from command-line arguments.
 *
 * Example:
 * --lines 100,500,1000
 * --iterations 5
 * --batch-size 100
 * --skip-stress
 *
 * If an option is missing, use its default value.
 */
function parseArgs(argv: string[]): {
  lines: number[];
  iterations: number;
  batchSize: number;
  skipStress: boolean;
  skipBatch: boolean;
  validateExternal: boolean;
} {

  // Find the value immediately after an argument name.
  // Example: ["--iterations", "5"] -> "5"
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  return {
    // Number of invoice line items to test.
    // Default: 100, 500, and 1000.
    lines: (get("--lines") ?? "100,500,1000")
      .split(",")
      .map(Number),

    // Number of timed runs for each operation.
    iterations: Number(get("--iterations") ?? 5),

    // Number of invoices in the batch test.
    batchSize: Number(get("--batch-size") ?? 100),

    // Flags are true when the option is present.
    skipStress: argv.includes("--skip-stress"),
    skipBatch: argv.includes("--skip-batch"),
    validateExternal: argv.includes("--validate-external"),
  };
}

// ======================================================
// TASK 2: STRESS TEST
// ======================================================

/**
 * Test performance with large invoices.
 * 
 * How fast can the system go?
 *
 * Example lineCounts = [100, 500, 1000].
 *
 * For each invoice size, measure:
 * 1. Schema validation
 * 2. Business-rule validation
 * 3. XRechnung XML generation
 * 4. Hybrid PDF generation
 *
 * Each operation is measured separately.
 */
async function stress(
  lineCounts: number[],
  iterations: number,
): Promise<void> {

  console.log(
    `\n== Stress: per-stage timing (${iterations} timed iterations after 1 warm-up) ==`,
  );

  // Test each requested invoice size.
  for (const n of lineCounts) {

    // Create a test invoice with n line items.
    const invoice = buildInvoice(n);

    console.log(`\n-- ${n} lines --`);

    // Define the operations we want to benchmark.
    // Each function is stored without executing it yet.
    const stages: [string, () => unknown][] = [

      // Check whether the invoice matches the data schema.
      [
        "schema validation",
        (): unknown => validateInvoiceSchema(invoice),
      ],

      // Check XRechnung business rules.
      [
        "business rules  ",
        (): unknown =>
          validateBusinessRules(invoice, "XRECHNUNG", {
            today: TODAY,
          }),
      ],

      // Generate the XRechnung XML document.
      [
        "toXRechnung     ",
        (): unknown => toXRechnung(invoice),
      ],

      // Generate a hybrid PDF containing invoice XML.
      [
        "toHybridPdf     ",
        (): unknown => toHybridPdf(invoice),
      ],
    ];

    // Benchmark each operation individually.
    for (const [name, run] of stages) {

      // Run warm-up and timed iterations.
      const r = await measureStage(iterations, run);

      // Print execution time and memory results. 17 is random number.
      console.log(
        `${name} ${fmtStats(r.stats)}\n${" ".repeat(17)}${fmtMem(r.peakMem)}`,
      );
    }
  }
}

// ======================================================
// TASK 3: BATCH TEST
// ======================================================

/**
 * Generate many different invoices sequentially.
 * 
 * Can the system go it repeatedly without overheating/leaking?
 *
 * Example: batch(100) generates 100 invoices.
 *
 * Measures:
 * 1. Total generation time
 * 2. Average time per invoice
 * 3. Highest sampled memory usage
 * 4. Memory trend after garbage collection
 *
 * This helps detect performance and memory problems
 * when processing many invoices in one process.
 */
async function batch(total: number): Promise<void> {

  // Get Node.js garbage collector if available.
  // Requires Node.js to run with --expose-gc.
  const gc = (globalThis as { gc?: () => void }).gc;

  console.log(
    `\n== Batch: ${total} distinct invoices through generateHybridPdf() ==`,
  );

  // Warn if manual garbage collection is unavailable.
  if (!gc) {
    console.log(
      "(run with --expose-gc to get post-GC baselines)",
    );
  }

  // Give each invoice between 5 and 24 line items.
  // This simulates different realistic invoice sizes.
  const linesFor = (i: number): number => 5 + (i % 20);

  // Warm up the PDF generator without measuring its time.
  await generateHybridPdf(buildInvoice(10, 9999));

  // Check memory approximately 10 times during the batch.
  // Example: 100 invoices -> every 10 invoices.
  const interval = Math.max(1, Math.floor(total / 10));

  // Store memory readings after garbage collection.
  const baselines: number[] = [];

  // Track the highest observed memory usage.
  let peakMem = mem();

  // Start the batch timer.
  const t0 = performance.now();

  // Generate invoices one at a time.
  for (let i = 1; i <= total; i++) {

    // Create a distinct invoice and generate its PDF.
    const { pdf, issues } = await generateHybridPdf(
      buildInvoice(linesFor(i), i),
    );

    // Stop the test if PDF generation fails.
    if (!pdf) {
      throw new Error(
        `batch invoice ${i} failed: ${JSON.stringify(issues[0])}`,
      );
    }

    // Record the highest sampled memory values.
    peakMem = peak(peakMem, mem());

    // Periodically run garbage collection and measure memory.
    if (i % interval === 0 && gc) {

      // Ask Node.js to collect unused objects.
      gc();

      // Measure memory remaining after GC.
      const m = mem();

      // Save heap usage to analyze its trend later.
      baselines.push(m.heapUsed);

      console.log(
        `  after ${String(i).padStart(4)}: post-GC ${fmtMem(m)}`,
      );
    }
  }

  // Calculate total execution time.
  const total_ms = performance.now() - t0;

  // Print total time and average time per invoice.
  console.log(
    `total ${(total_ms / 1000).toFixed(2)} s (${(total_ms / total).toFixed(1)} ms/invoice)`,
  );

  // Print highest sampled memory usage.
  console.log(
    `highest sample (between invoices) ${fmtMem(peakMem)}`,
  );

  // Analyze memory growth if enough samples exist.
  if (baselines.length >= 4) {

    // Ignore the first reading because memory may
    // still be stabilizing after warm-up.
    const rest = baselines.slice(1);

    // Split the remaining samples into two groups.
    const half = Math.floor(rest.length / 2);

    // Helper function to calculate an average.
    const avg = (xs: number[]): number =>
      xs.reduce((a, b) => a + b, 0) / xs.length;

    // Average memory during the first half.
    const first = avg(rest.slice(0, half));

    // Average memory during the second half.
    const second = avg(rest.slice(half));

    // Calculate percentage change in heap usage.
    // Positive means memory increased.
    // Negative means memory decreased.
    const growth = ((second - first) / first) * 100;

    // Display the memory trend.
    // Sustained growth may indicate a memory leak,
    // but this result alone cannot prove one.
    console.log(
      `post-GC heapUsed trend: ${mb(first)} MB -> ${mb(second)} MB (${growth.toFixed(1)}%)`,
    );
  }
}

// ---------- Optional: external correctness at scale (pass/fail, never timed) ----------

/**
 * Optional large-document correctness check.
 *
 * Does the system still work correctly when I push it to an extreme?
 * 
 * Confirms that generated 100/500/1000-line outputs still pass KoSIT, Mustang and veraPDF,
 * and that the XML embedded in the PDF is unchanged.
 *
 * This is not part of performance timing and does not replace the normal fixture
 * validation suite.
 */
async function validateExternal(lineCounts: number[]): Promise<boolean> {
  console.log(
    "\n== External correctness at scale (pass/fail, not part of timing) ==",
  );

  // Create a temporary folder where the XML and PDF files can be saved.
  const dir = mkdtempSync(join(tmpdir(), "oix-bench-"));

  // Assume everything passes at the beginning.
  let ok = true;

  /**
   * Print whether one validation check passed or failed.
   *
   * If errors = 0:
   * pass
   *
   * If errors > 0:
   * FAIL
   */
  const report = (label: string, errors: number): void => {
    console.log(
      `  ${label}: ${errors === 0 ? "pass" : `FAIL (${errors} error(s))`}`,
    );

    // If one check fails, remember that the whole validation failed.
    if (errors > 0) ok = false;
  };

  /**
   * Count how many real errors exist in validator results.
   *
   * Warnings are ignored.
   * Only severity === "error" is counted.
   */
  const errorCount = (
    r: { issues: { severity: string }[] }[],
  ): number =>
    r.reduce(
      (n, x) =>
        n + x.issues.filter((i) => i.severity === "error").length,
      0,
    );

  // Test every requested invoice size.
  for (const n of lineCounts) {

    // Create a test invoice.
    // Example: n = 500 means an invoice with 500 line items.
    const invoice = buildInvoice(n);

    // Generate XRechnung XML.
    const xml = toXRechnung(invoice);

    // Generate the hybrid PDF.
    const pdf = await toHybridPdf(invoice);

    // Decide where the generated files will be saved.
    const xmlPath = join(dir, `${n}.xml`);
    const pdfPath = join(dir, `${n}.pdf`);
    const embeddedPath = join(dir, `${n}-embedded.xml`);

    // Save the normal XML file.
    writeFileSync(xmlPath, xml);

    // Save the hybrid PDF file.
    writeFileSync(pdfPath, pdf);

    // Take the XML that is embedded inside the PDF.
    const embedded = await extractEmbeddedXml(pdfPath);

    // Save that extracted XML as a separate file.
    // This allows KoSIT and Mustang to validate it too.
    writeFileSync(embeddedPath, embedded);

    console.log(`XML, ${n} lines`);

    // Validate the normal XML with KoSIT.
    report(
      "KoSIT",
      errorCount(runKosit([xmlPath])),
    );

    // Validate the normal XML with Mustang.
    report(
      "Mustang",
      errorCount(runMustang([xmlPath])),
    );

    console.log(`Hybrid PDF, ${n} lines`);

    // Validate the PDF/A format with veraPDF.
    report(
      "veraPDF",
      errorCount(runVeraPdf([pdfPath])),
    );

    // Check that the XML inside the PDF is exactly the same
    // as the XML generated by toXRechnung().
    report(
      "embedded XML identical to toXRechnung()",
      embedded === xml ? 0 : 1,
    );

    // Validate the XML extracted from the PDF with KoSIT.
    report(
      "embedded XML, KoSIT",
      errorCount(runKosit([embeddedPath])),
    );

    // Validate the XML extracted from the PDF with Mustang.
    report(
      "embedded XML, Mustang",
      errorCount(runMustang([embeddedPath])),
    );
  }

  // Return true if every check passed.
  // Return false if at least one check failed.
  return ok;
}

/**
 * Main entry point for the benchmark script.
 *
 * This decides which benchmark parts should run.
 */
async function main(): Promise<void> {

  // Read command-line options.
  const args = parseArgs(process.argv.slice(2));

  // Get information about the computer's CPUs.
  const cpu = cpus();

  // Print information about the machine running the benchmark.
  console.log(
    `node ${process.version} on ${platform()} ${arch()}, ${cpu.length}x ${cpu[0]?.model ?? "unknown cpu"}, ` +
      `${(totalmem() / 1024 ** 3).toFixed(1)} GB RAM`,
  );

  // Run the large-invoice stress benchmark,
  // unless --skip-stress was used.
  if (!args.skipStress) {
    await stress(args.lines, args.iterations);
  }

  // Run the batch benchmark,
  // unless --skip-batch was used.
  if (!args.skipBatch) {
    await batch(args.batchSize);
  }

  // Run external validation only if
  // --validate-external was used.
  if (
    args.validateExternal &&
    !(await validateExternal(args.lines))
  ) {
    // Exit with error code 1 if validation failed.
    // This tells the terminal/script that something went wrong.
    process.exit(1);
  }
}

// Only start main() when this file is executed directly.
//
// If another file imports functions from this file,
// main() should NOT automatically run.
if (
  import.meta.url ===
  pathToFileURL(process.argv[1] ?? "").href
) {
  await main();
}