#!/usr/bin/env bash
# Downloads the KoSIT validator (Java CLI) and the XRechnung validator configuration
# (Schematron/XSD scenario definitions) into tools/kosit/, and a portable JRE into
# tools/jre/ if no `java` binary is already on PATH. Versions are pinned so validation
# results are reproducible across machines and CI.
# -e = Exit on error
# -u = Undefined variable is an error
# -o = Option, here is enable the "pipefail" option
set -euo pipefail

# go to the root
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# itplr-kosit/validator — The validator program. 
# It is a generic Java tool that checks XML files. 
# By itself, it doesn't know what an XRechnung invoice is or which rules to apply.
VALIDATOR_VERSION="1.6.2"
VALIDATOR_JAR_URL="https://github.com/itplr-kosit/validator/releases/download/v${VALIDATOR_VERSION}/validator-${VALIDATOR_VERSION}-standalone.jar"

# itplr-kosit/validator-configuration-xrechnung — The XRechnung rulebook. 
# It contains all the XRechnung validation rules and tells the validator program exactly what to check.
CONFIG_TAG="v2026-01-31"
CONFIG_ZIP_NAME="xrechnung-3.0.2-validator-configuration-2026-01-31.zip"
CONFIG_ZIP_URL="https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/download/${CONFIG_TAG}/${CONFIG_ZIP_NAME}"

# To download Java Runtime Environment (JRE)
# The machine that runs Java programs.
JRE_URL="https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.19%2B10/OpenJDK17U-jre_x64_linux_hotspot_17.0.19_10.tar.gz"

mkdir -p tools/kosit

echo "Downloading KoSIT validator ${VALIDATOR_VERSION}..."
# -s Slient mode
# -L Follow redirects
# -o Output file
# save it as tools/kosit/validator.jar
curl -sL -o tools/kosit/validator.jar "$VALIDATOR_JAR_URL"

echo "Downloading XRechnung validator configuration (${CONFIG_TAG})..."
curl -sL -o /tmp/kosit-config.zip "$CONFIG_ZIP_URL"
# -f Force deletion without asking
# Delete previous configuration
rm -rf tools/kosit/config
# -q Quite mode
# -o Overwrite exising files
# -d extract into this directory
unzip -q -o /tmp/kosit-config.zip -d tools/kosit/config
rm -f /tmp/kosit-config.zip

# Find a program named java
# >/dev/null → send stdout to the trash
# 2>&1 → send stderr to wherever stdout is now pointing (which is also the trash).
if command -v java >/dev/null 2>&1; then
  echo "Using java on PATH: $(command -v java)"
else
  echo "No java on PATH — downloading a portable JRE (no root required)..."
  mkdir -p tools/jre
  curl -sL -o /tmp/kosit-jre.tar.gz "$JRE_URL"
  # - -x — extract (as opposed to creating an archive)
  # - -z — the archive is gzip-compressed (.tar.gz), so decompress first
  # - -f /tmp/kosit-jre.tar.gz — the file to extract from
  # - -C tools/jre — change to directory tools/jre before extracting (i.e., put the extracted files there, instead of the current directory)
  # - --strip-components=1 — drop the first folder level from every path inside the archive
  tar -xzf /tmp/kosit-jre.tar.gz -C tools/jre --strip-components=1
  rm -f /tmp/kosit-jre.tar.gz
  echo "Portable JRE installed at tools/jre/bin/java"
fi

echo "Done. Run 'make validate-kosit' to validate generated XML."
