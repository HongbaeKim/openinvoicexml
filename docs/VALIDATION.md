# Validating XRechnung output

`adapters/xrechnung.ts` produces XML by construction, but only the official **KoSIT
validator** (`itplr-kosit/validator`) can confirm it actually conforms to the XRechnung
3.x XSD and Schematron rules. This project wires that tool into a local `make` target so
"passes KoSIT with zero errors" is a repeatable check, not a manual read of the spec.

## Prerequisites

- Java 11+ **or** none at all — `make kosit-setup` downloads a portable JRE (Eclipse
  Temurin 17) into `tools/jre/` if no `java` binary is found on `PATH`. No root/sudo
  required either way.
- Network access, for the one-time download in `make kosit-setup`.

## One-time setup

```bash
make kosit-setup
```

This downloads, into the git-ignored `tools/` directory:

- `tools/kosit/validator.jar` — the KoSIT validator CLI ([itplr-kosit/validator](https://github.com/itplr-kosit/validator))
- `tools/kosit/config/` — the XRechnung 3.0.x scenario/Schematron/XSD bundle ([itplr-kosit/validator-configuration-xrechnung](https://github.com/itplr-kosit/validator-configuration-xrechnung))
- `tools/jre/` — a portable JRE, only if `java` wasn't already available

Versions are pinned in `scripts/setup-kosit.sh` so results are reproducible across
machines and CI; bump them there when a new XRechnung version ships.

## Running validation

```bash
make validate-kosit
```

This regenerates XML from all fixtures (`make generate`) and runs each file through
KoSIT via `validators/kosit.ts`'s `runKosit()`. Output looks like:

```
✓ dist/xml/domestic-simple.xml
✓ dist/xml/domestic-multi-line.xml
✗ dist/xml/exempt.xml — 1 error(s)
    [BR-DE-2] Die Gruppe "SELLER CONTACT" (BG-6) muss übermittelt werden.
```

The command exits non-zero if any file has an `error`-severity finding — safe to wire
into CI once a pipeline exists. `warning` and `information`-level findings are printed
by inspecting the `KositResult.issues` array directly (see `validators/kosit.ts`); they
don't fail the build. Accepted findings of that kind are tracked in
[`LIMITATIONS.md`](LIMITATIONS.md).

## How it works

`runKosit()` shells out to `java -jar tools/kosit/validator.jar -s
tools/kosit/config/scenarios.xml -o <reportDir> <xmlFiles...>` and parses the
`<name>-report.xml` KoSIT writes per input file into a structured
`{ file, valid, issues: [{ severity, message, location }] }` result — no XML-parsing
dependency is added; a small hand-rolled tag scan is enough for the two things this
project needs (severity + message).
