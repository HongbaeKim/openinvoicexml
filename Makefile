.ONESHELL:
.PHONY: test type lint generate validate-xml

test:
	npm test

type:
	npm run typecheck

lint:
	npm run lint

generate:
	node --input-type=module <<'EOF'
	import { readFileSync, writeFileSync, mkdirSync } from "fs";
	import { toXRechnung } from "./dist/adapters/index.js";
	const names = ["domestic-simple","domestic-multi-line","reduced-rate","exempt","zero-rated","reverse-charge"];
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
	for (const f of readdirSync("dist/xml").filter(f => f.endsWith(".xml"))) {
	  const xml = readFileSync("dist/xml/" + f, "utf8");
	  if (!xml.startsWith("<?xml")) throw new Error(f + ": missing XML declaration");
	  console.log("✓ " + f);
	}
	EOF