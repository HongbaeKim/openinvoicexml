.ONESHELL:
.PHONY: test type lint generate validate-xml kosit-setup validate-kosit generate-pdf validate-pdf-attachment verapdf-setup validate-verapdf validate-hybrid mustang-setup validate-mustang generate-cii validate-cii-kosit generate-facturx-pdf validate-facturx

all: lint type test

build:
	npm run build

test:
	npm test

type:
	npm run typecheck

lint:
	npm run lint

generate:
	node --input-type=module <<'EOF'
	import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "fs";
	import { toXRechnung } from "./dist/adapters/index.js";
	const names = readdirSync("fixtures")
	  .filter(f => f.endsWith(".invoice.json"))
	  .map(f => f.slice(0, -".invoice.json".length))
	  .sort();
	mkdirSync("dist/xml", { recursive: true });
	for (const n of names) {
	  const inv = JSON.parse(readFileSync("fixtures/" + n + ".invoice.json", "utf8"));
	  writeFileSync("dist/xml/" + n + ".xml", toXRechnung(inv));
	}
	EOF

# only check is it xml file or not with first "<?xml"
validate-xml: generate
	node --input-type=module <<'EOF'
	import { readFileSync, readdirSync } from "fs";
	for (const f of readdirSync("dist/xml").filter(f => f.endsWith(".xml")).sort()) {
	  const xml = readFileSync("dist/xml/" + f, "utf8");
	  if (!xml.startsWith("<?xml")) throw new Error(f + ": missing XML declaration");
	  console.log("✓ " + f);
	}
	EOF

# one-time download of the KoSIT validator jar + XRechnung scenario config (+ a
# portable JRE if java isn't already on PATH) into tools/ (git-ignored)
kosit-setup:
	bash scripts/setup-kosit.sh

# generates XML from all fixtures, then runs it through the real KoSIT validator;
# exits non-zero if any file has an error-severity Schematron/XSD finding
# Only filters "error"

# and expected output will be
# ✗ dist/xml/invoice1.xml — 2 error(s)
#     Missing BuyerReference
#     Seller VAT ID missing
# ✓ dist/xml/invoice2.xml
validate-kosit: generate
	node --input-type=module <<'EOF'
	import { runKosit } from "./dist/validators/index.js";
	import { readdirSync } from "fs";
	const files = readdirSync("dist/xml").filter(f => f.endsWith(".xml")).sort().map(f => "dist/xml/" + f);
	const results = runKosit(files);
	let failed = false;
	for (const r of results) {
	  const errors = r.issues.filter(i => i.severity === "error");
	  console.log((errors.length ? "✗ " : "✓ ") + r.file + (errors.length ? " — " + errors.length + " error(s)" : ""));
	  for (const e of errors) console.log("    " + e.message);
	  if (errors.length) failed = true;
	}
	if (failed) process.exit(1);
	EOF

# generates a PDF/A-3 invoice (with the XRechnung UBL XML embedded as an associated file) for
# every fixture into dist/pdf/ — for manual inspection (open a PDF in a real viewer)
generate-pdf:
	node --input-type=module <<'EOF'
	import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "fs";
	import { toHybridPdf } from "./dist/adapters/index.js";
	const names = readdirSync("fixtures")
	  .filter(f => f.endsWith(".invoice.json"))
	  .map(f => f.slice(0, -".invoice.json".length))
	  .sort();
	mkdirSync("dist/pdf", { recursive: true });
	for (const n of names) {
	  const inv = JSON.parse(readFileSync("fixtures/" + n + ".invoice.json", "utf8"));
	  writeFileSync("dist/pdf/" + n + ".pdf", await toHybridPdf(inv));
	  console.log("wrote dist/pdf/" + n + ".pdf");
	}
	EOF

# generates a PDF for every fixture, then extracts each one's embedded xrechnung.xml attachment
# and compares it against toXRechnung() called directly on the same fixture; exits non-zero if
# any fixture's attachment is missing or doesn't match byte-for-byte
#
# expected output will be
# ✓ 01.domestic-simple
# ✗ 02.domestic-multi-line — attachment content differs
validate-pdf-attachment: generate-pdf
	node --input-type=module <<'EOF'
	import { readFileSync, readdirSync } from "fs";
	import { toXRechnung, extractEmbeddedXml } from "./dist/adapters/index.js";
	const names = readdirSync("fixtures")
	  .filter(f => f.endsWith(".invoice.json"))
	  .map(f => f.slice(0, -".invoice.json".length))
	  .sort();
	let failed = false;
	for (const n of names) {
	  const inv = JSON.parse(readFileSync("fixtures/" + n + ".invoice.json", "utf8"));
	  const expected = toXRechnung(inv);
	  let actual, reason = "";
	  try {
	    actual = await extractEmbeddedXml("dist/pdf/" + n + ".pdf");
	  } catch (err) {
	    reason = " — " + err.message;
	  }
	  const ok = actual === expected;
	  if (!reason) reason = ok ? "" : " — attachment content differs";
	  console.log((ok ? "✓ " : "✗ ") + n + reason);
	  if (!ok) failed = true;
	}
	if (failed) process.exit(1);
	EOF

# one-time download + unattended install of the veraPDF CLI (PDF/A validator) into
# tools/verapdf/ (git-ignored); reuses tools/jre/ if kosit-setup already downloaded a portable JRE
verapdf-setup:
	bash scripts/setup-verapdf.sh

# generates a hybrid PDF for every fixture, then runs each through the real veraPDF validator;
# exits non-zero if any file has an error-severity PDF/A-3B conformance finding
validate-verapdf: generate-pdf
	node --input-type=module <<'EOF'
	import { runVeraPdf } from "./dist/validators/index.js";
	import { readdirSync } from "fs";
	const files = readdirSync("dist/pdf").filter(f => f.endsWith(".pdf")).sort().map(f => "dist/pdf/" + f);
	const results = runVeraPdf(files);
	let failed = false;
	for (const r of results) {
	  const errors = r.issues.filter(i => i.severity === "error");
	  console.log((errors.length ? "✗ " : "✓ ") + r.file + (errors.length ? " — " + errors.length + " error(s)" : ""));
	  for (const e of errors) console.log("    " + e.message);
	  if (errors.length) failed = true;
	}
	if (failed) process.exit(1);
	EOF

# generates a hybrid PDF for every fixture, runs each through veraPDF (PDF/A-3b conformance),
# then extracts the embedded XML (adapters/extractEmbeddedXml) and runs that through KoSIT
# (XRechnung XSD/Schematron conformance) — the round-trip proof that what a real recipient
# would extract from the PDF is itself a conformant XRechnung document, not just that the PDF
# passes PDF/A-3b on its own. Extraction failures are reported per fixture, not a hard crash —
# a broken attachment on one fixture shouldn't block extracting or KoSIT-checking the rest.
validate-hybrid: generate-pdf
	node --input-type=module <<'EOF'
	import { readdirSync, mkdirSync, writeFileSync } from "fs";
	import { extractEmbeddedXml } from "./dist/adapters/index.js";
	import { runVeraPdf, runKosit } from "./dist/validators/index.js";
	const names = readdirSync("fixtures")
	  .filter(f => f.endsWith(".invoice.json"))
	  .map(f => f.slice(0, -".invoice.json".length))
	  .sort();
	const pdfPaths = names.map(n => "dist/pdf/" + n + ".pdf");
	let hybridFailed = false;

	console.log("--- veraPDF (PDF/A-3b conformance) ---");
	const veraResults = runVeraPdf(pdfPaths);
	for (const r of veraResults) {
	  const errors = r.issues.filter(i => i.severity === "error");
	  console.log((errors.length ? "✗ " : "✓ ") + r.file + (errors.length ? " — " + errors.length + " error(s)" : ""));
	  for (const e of errors) console.log("    " + e.message);
	  if (errors.length) hybridFailed = true;
	}

	console.log("--- embedded XML extraction + KoSIT ---");
	mkdirSync("dist/xml-from-pdf", { recursive: true });
	const xmlPaths = [];
	for (const n of names) {
	  const pdfPath = "dist/pdf/" + n + ".pdf";
	  try {
	    const xml = await extractEmbeddedXml(pdfPath);
	    const xmlPath = "dist/xml-from-pdf/" + n + ".xml";
	    writeFileSync(xmlPath, xml);
	    xmlPaths.push(xmlPath);
	  } catch (err) {
	    console.log("✗ " + pdfPath + " — " + (err instanceof Error ? err.message : String(err)));
	    hybridFailed = true;
	  }
	}
	const kositResults = runKosit(xmlPaths);
	for (const r of kositResults) {
	  const errors = r.issues.filter(i => i.severity === "error");
	  console.log((errors.length ? "✗ " : "✓ ") + r.file + (errors.length ? " — " + errors.length + " error(s)" : ""));
	  for (const e of errors) console.log("    " + e.message);
	  if (errors.length) hybridFailed = true;
	}

	if (hybridFailed) process.exit(1);
	EOF

# one-time download of the Mustang Project CLI (a single runnable jar, an independent
# third-party e-invoicing tool) into tools/mustang/ (git-ignored); reuses tools/jre/ if
# kosit-setup or verapdf-setup already downloaded a portable JRE
mustang-setup:
	bash scripts/setup-mustang.sh

# generates a hybrid PDF for every fixture, then cross-checks each one against Mustang Project's
# CLI — an independent third-party tool, not this project's own code: Mustang's own --action
# extract must recover XML byte-identical to toXRechnung()'s direct output, and Mustang's own
# --action validate (run against that same extracted XML, not the PDF — see docs/COMPLIANCE.md
# for why) must raise no error-severity EN16931/XRechnung UBL finding; exits non-zero on either
# failure
validate-mustang: generate-pdf
	node --input-type=module <<'EOF'
	import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "fs";
	import { toXRechnung } from "./dist/adapters/index.js";
	import { extractWithMustang, runMustang } from "./dist/validators/index.js";
	const names = readdirSync("fixtures")
	  .filter(f => f.endsWith(".invoice.json"))
	  .map(f => f.slice(0, -".invoice.json".length))
	  .sort();
	mkdirSync("dist/xml-from-mustang", { recursive: true });
	let failed = false;
	const xmlPaths = [];
	for (const n of names) {
	  const inv = JSON.parse(readFileSync("fixtures/" + n + ".invoice.json", "utf8"));
	  const expected = toXRechnung(inv);
	  const pdfPath = "dist/pdf/" + n + ".pdf";
	  let extracted, reason = "";
	  try {
	    extracted = extractWithMustang(pdfPath);
	  } catch (err) {
	    reason = " — " + err.message;
	  }
	  const ok = extracted === expected;
	  if (!reason) reason = ok ? "" : " — extracted content differs";
	  console.log((ok ? "✓ " : "✗ ") + n + " (extract)" + reason);
	  if (!ok) { failed = true; continue; }
	  const xmlPath = "dist/xml-from-mustang/" + n + ".xml";
	  writeFileSync(xmlPath, extracted);
	  xmlPaths.push(xmlPath);
	}
	const results = runMustang(xmlPaths);
	for (const r of results) {
	  const errors = r.issues.filter(i => i.severity === "error");
	  console.log((errors.length ? "✗ " : "✓ ") + r.file + " (validate)" + (errors.length ? " — " + errors.length + " error(s)" : ""));
	  for (const e of errors) console.log("    " + e.message);
	  if (errors.length) failed = true;
	}
	if (failed) process.exit(1);
	EOF

# generates standalone CII XML for every fixture, both profiles, into dist/cii/<profile>/ —
# a subfolder per profile (not just a filename suffix) since EN16931 and XRechnung now produce
# genuinely different content, not just different metadata (see adapters/cii.ts)
generate-cii:
	node --input-type=module <<'EOF'
	import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "fs";
	import { toCii } from "./dist/adapters/index.js";
	const names = readdirSync("fixtures")
	  .filter(f => f.endsWith(".invoice.json"))
	  .map(f => f.slice(0, -".invoice.json".length))
	  .sort();
	for (const profile of ["en16931", "xrechnung"]) {
	  mkdirSync("dist/cii/" + profile, { recursive: true });
	  for (const n of names) {
	    const inv = JSON.parse(readFileSync("fixtures/" + n + ".invoice.json", "utf8"));
	    const xml = toCii(inv, { profile: profile.toUpperCase() });
	    writeFileSync("dist/cii/" + profile + "/" + n + ".xml", xml);
	  }
	}
	console.log("wrote dist/cii/en16931/ and dist/cii/xrechnung/");
	EOF

# runs both profiles' standalone CII XML through the real KoSIT validator; KoSIT self-selects
# the matching scenario per file from its GuidelineSpecifiedDocumentContextParameter (EN16931
# (CII) vs EN16931 XRechnung (CII)), so both subfolders go through the same runKosit() call —
# exits non-zero if any file has an error-severity XSD/Schematron finding
validate-cii-kosit: generate-cii
	node --input-type=module <<'EOF'
	import { runKosit } from "./dist/validators/index.js";
	import { readdirSync } from "fs";
	let failed = false;
	for (const profile of ["en16931", "xrechnung"]) {
	  console.log("--- " + profile + " ---");
	  const dir = "dist/cii/" + profile;
	  const files = readdirSync(dir).filter(f => f.endsWith(".xml")).sort().map(f => dir + "/" + f);
	  const results = runKosit(files);
	  for (const r of results) {
	    const errors = r.issues.filter(i => i.severity === "error");
	    console.log((errors.length ? "✗ " : "✓ ") + r.file + (errors.length ? " — " + errors.length + " error(s)" : ""));
	    for (const e of errors) console.log("    " + e.message);
	    if (errors.length) failed = true;
	  }
	}
	if (failed) process.exit(1);
	EOF

# generates a Factur-X/ZUGFeRD hybrid PDF (CII embedded via embedFacturX() — a genuine
# conformance claim, unlike generate-pdf/toHybridPdf()'s plain UBL attachment) for every
# fixture, both profiles, into dist/facturx-pdf/<profile>/
generate-facturx-pdf:
	node --input-type=module <<'EOF'
	import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "fs";
	import { toFacturXPdf } from "./dist/adapters/index.js";
	const names = readdirSync("fixtures")
	  .filter(f => f.endsWith(".invoice.json"))
	  .map(f => f.slice(0, -".invoice.json".length))
	  .sort();
	for (const profile of ["en16931", "xrechnung"]) {
	  mkdirSync("dist/facturx-pdf/" + profile, { recursive: true });
	  for (const n of names) {
	    const inv = JSON.parse(readFileSync("fixtures/" + n + ".invoice.json", "utf8"));
	    const pdf = await toFacturXPdf(inv, { profile: profile.toUpperCase() });
	    writeFileSync("dist/facturx-pdf/" + profile + "/" + n + ".pdf", pdf);
	  }
	  console.log("wrote dist/facturx-pdf/" + profile + "/");
	}
	EOF

# the real proof-of-conformance target for Factur-X/ZUGFeRD output. Per profile: runs veraPDF
# (PDF/A-3b conformance) against the generated PDFs; extracts each one's factur-x.xml attachment
# and runs that through KoSIT (lands on EN16931 (CII) for the en16931 subfolder, EN16931
# XRechnung (CII) for the xrechnung one); and — the concrete before/after proof this addendum
# exists to produce — runs Mustang directly against the PDF itself, no extraction step first.
# Before this addendum, that same call against the UBL-only hybrid PDF returned Mustang's
# "Factur-X/ZUGFeRD and Order-X are always strictly CII only, no UBL allowed" rejection.
validate-facturx: generate-facturx-pdf
	node --input-type=module <<'EOF'
	import { readdirSync, mkdirSync, writeFileSync } from "fs";
	import { extractEmbeddedXml } from "./dist/adapters/index.js";
	import { runVeraPdf, runKosit, runMustang } from "./dist/validators/index.js";
	let failed = false;
	for (const profile of ["en16931", "xrechnung"]) {
	  console.log("=== " + profile + " ===");
	  const pdfDir = "dist/facturx-pdf/" + profile;
	  const names = readdirSync(pdfDir).filter(f => f.endsWith(".pdf")).sort()
	    .map(f => f.slice(0, -".pdf".length));
	  const pdfPaths = names.map(n => pdfDir + "/" + n + ".pdf");

	  console.log("--- veraPDF (PDF/A-3b conformance) ---");
	  const veraResults = runVeraPdf(pdfPaths);
	  for (const r of veraResults) {
	    const errors = r.issues.filter(i => i.severity === "error");
	    console.log((errors.length ? "✗ " : "✓ ") + r.file + (errors.length ? " — " + errors.length + " error(s)" : ""));
	    for (const e of errors) console.log("    " + e.message);
	    if (errors.length) failed = true;
	  }

	  console.log("--- extracted factur-x.xml + KoSIT ---");
	  mkdirSync("dist/cii-from-facturx-pdf/" + profile, { recursive: true });
	  const xmlPaths = [];
	  for (const n of names) {
	    const pdfPath = pdfDir + "/" + n + ".pdf";
	    try {
	      const xml = await extractEmbeddedXml(pdfPath, "factur-x.xml");
	      const xmlPath = "dist/cii-from-facturx-pdf/" + profile + "/" + n + ".xml";
	      writeFileSync(xmlPath, xml);
	      xmlPaths.push(xmlPath);
	    } catch (err) {
	      console.log("✗ " + pdfPath + " — " + (err instanceof Error ? err.message : String(err)));
	      failed = true;
	    }
	  }
	  const kositResults = runKosit(xmlPaths);
	  for (const r of kositResults) {
	    const errors = r.issues.filter(i => i.severity === "error");
	    console.log((errors.length ? "✗ " : "✓ ") + r.file + (errors.length ? " — " + errors.length + " error(s)" : ""));
	    for (const e of errors) console.log("    " + e.message);
	    if (errors.length) failed = true;
	  }

	  console.log("--- Mustang, direct against the PDF (no extraction) ---");
	  const mustangResults = runMustang(pdfPaths);
	  for (const r of mustangResults) {
	    const errors = r.issues.filter(i => i.severity === "error");
	    console.log((errors.length ? "✗ " : "✓ ") + r.file + (errors.length ? " — " + errors.length + " error(s)" : ""));
	    for (const e of errors) console.log("    " + e.message);
	    if (errors.length) failed = true;
	  }
	}
	if (failed) process.exit(1);
	EOF