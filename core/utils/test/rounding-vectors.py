#!/usr/bin/env python3
"""
Generates reference data to test OpenInvoiceXML's decimal calculations.

Why do we need this?
JavaScript sometimes makes small rounding errors with decimal numbers.

Example:
    30 × 0.0055 = 0.165
    Round to 2 decimals = 0.17

Python's decimal module calculates these values exactly.
We use it to check that our TypeScript rounding engine gives
the same correct results.

Important:
- Python does NOT use our TypeScript calculation code.
- This makes the tests independent and helps detect rounding bugs.
- Python is only needed to regenerate rounding-vectors.json.
- Running npm test, building, or using OpenInvoiceXML does not require Python.

Rounding method:
ROUND_HALF_UP rounds halfway values away from zero.

Examples:
    0.165  →  0.17
   -0.165  → -0.17

Invoice calculations:
    Line net amount (BT-131):
        round2(quantity × unitPrice) + charges - allowances

    VAT amount (BT-117):
        round2(taxable × VAT rate / 100)

These follow the supported Peppol BIS Billing 3.0 calculation model.

To regenerate the reference JSON:
    python3 core/utils/test/rounding-vectors.py > core/utils/test/rounding-vectors.json

The generated JSON contains fixed examples and reproducible random examples.
Do not edit the JSON manually.
"""

import json
import random
from decimal import Decimal, ROUND_HALF_UP, getcontext

# Use high precision for the reference calculations.
# This reduces the risk of intermediate rounding affecting expected results.
getcontext().prec = 400

# One cent, represented exactly as a Python Decimal.
CENT = Decimal("0.01")


def r(value, places):
    """
    Round a Decimal to the requested number of decimal places.

    Examples:
        r(Decimal("0.165"), 2)  → Decimal("0.17")
        r(Decimal("-0.165"), 2) → Decimal("-0.17")
    """
    return value.quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)


def line(q, p, charges=(), allowances=()):
    """
    Calculate an invoice line net amount (BT-131).

    Steps:
    1. Multiply quantity by unit price.
    2. Round the product to 2 decimals.
    3. Add any extra charges.
    4. Subtract any discounts (allowances).

    Example:
        Quantity: 3
        Price:    1.005
        Discount: 1.00

        3 × 1.005 = 3.015
        Round     = 3.02
        3.02 - 1.00 = 2.02
    """
    return r(Decimal(q) * Decimal(p), 2) + sum((Decimal(c) for c in charges), Decimal(0)) - sum((Decimal(a) for a in allowances), Decimal(0))


def vat(taxable, rate):
    """
    Calculate VAT (BT-117) for a taxable amount.

    Example:
        Taxable amount: 14.50
        VAT rate:       7%

        14.50 × 7 / 100 = 1.015
        Round to cents  = 1.02
    """
    return r(Decimal(taxable) * Decimal(rate) / Decimal(100), 2)


def text(d):
    """
    Convert a Decimal into ordinary decimal text.

    Examples:
        Decimal("1.50")  → "1.50"
        Decimal("-0.00") → "0.00"

    Negative zero is removed because the TypeScript engine
    also avoids writing "-0.00" in invoice amounts.
    """
    return format(d.copy_abs() if d.is_zero() else d, "f")


# ------------------------------------------------------------
# 1. Fixed rounding examples
# ------------------------------------------------------------
# These check normal rounding, half-cent values, negative amounts,
# very small values, large values and scientific notation.
#
# Each case stores:
#   value:    the input decimal
#   places:   how many decimals to keep
#   expected: the correct rounded result
round_cases = []
for v, places in [
    ("0.165", 2), ("-0.165", 2), ("0.055", 2), ("-0.055", 2), ("1.005", 2), ("-1.005", 2), ("3.015", 2), ("2.675", 2),
    ("1.115", 2), ("0.005", 2), ("-0.005", 2), ("0.0049999999", 2), ("-0.0049999999", 2), ("0.995", 2), ("-0.995", 2),
    ("999999999999.995", 2), ("0", 2), ("0.00000000005", 10), ("0.00000000004", 10), ("1.23456789015", 10),
    ("-1.23456789015", 10), ("12.5", 0), ("-12.5", 0), ("0.5", 0), ("-0.5", 0), ("1e-7", 2), ("1.5e2", 2),
]:
    round_cases.append({"value": v, "places": places, "expected": text(r(Decimal(v), places))})

# ------------------------------------------------------------
# 2. Fixed invoice line calculations (BT-131)
# ------------------------------------------------------------
# These test quantity × unit price.
#
# Examples:
#   30 × 0.0055 = 0.165 → 0.17
#   10 × 0.0055 = 0.055 → 0.06
#   3 × 1.005   = 3.015 → 3.02
#
# Negative quantities are also included to test negative rounding.
line_cases = []
fixed_lines = [
    ("30", "0.0055"), ("-30", "0.0055"), ("10", "0.0055"), ("-10", "0.0055"), ("1000", "0.0055"), ("3", "0.0055"),
    ("1", "1.005"), ("3", "1.005"), ("-3", "1.005"), ("1", "2.675"), ("1", "1.115"), ("2", "95.00"), ("1", "120"),
    ("-8", "125"), ("12", "110"), ("-2", "50"), ("0.5", "0.01"), ("1", "0.004"), ("0.333333", "3"),
    ("1000000", "9999.9999"), ("1", "0.0000000001"), ("0", "123.45"), ("1.0000000001", "1"),
    ("123456789", "0.1234567891"), ("1e3", "0.0055"), ("1e-3", "5"),
]
for q, p in fixed_lines:
    line_cases.append({"quantity": q, "unitPrice": p, "charges": [], "allowances": [], "expected": text(line(q, p))})
# ------------------------------------------------------------
# 3. Invoice lines with charges and discounts
# ------------------------------------------------------------
# Peppol R120 requires the quantity × price part to be rounded
# before adding charges and subtracting allowances.
#
# Example:
#   1 × 0.005 = 0.005
#   Round first = 0.01
#   Discount = 1.00
#   Final = 0.01 - 1.00 = -0.99
#
# Rounding only after subtracting would give -1.00,
# which is different.
for q, p, charges, allowances in [
    ("1", "0.005", [], ["1.00"]),      # 0.01 - 1.00 = -0.99 (rounding the sum -0.995 would give -1.00)
    ("-1", "0.005", ["1.00"], []),     # -0.01 + 1.00 = 0.99
    ("30", "0.0055", ["0.50"], ["0.10"]),
    ("2", "95.00", [], ["10.00", "0.50"]),
    ("1", "10", ["2.50"], ["12.50"]),  # 0.00
    ("3", "1.005", [], ["3.02"]),
]:
    line_cases.append({"quantity": q, "unitPrice": p, "charges": charges, "allowances": allowances, "expected": text(line(q, p, charges, allowances))})

# ------------------------------------------------------------
# 4. Fixed VAT calculation examples (BT-117)
# ------------------------------------------------------------
# These check VAT calculations using different rates,
# positive and negative amounts, and half-cent values.
#
# Example:
#   14.50 × 7% = 1.015 → 1.02
vat_cases = []
for t, rate in [
    ("5.69", "19"), ("0.50", "19"), ("-0.50", "19"), ("2.50", "7"), ("-2.50", "7"), ("310.00", "19"), ("2675.00", "19"),
    ("2750.00", "7"), ("0.51", "19"), ("100.00", "0"), ("-1000.00", "19"), ("1220.00", "19"), ("0.05", "10"),
    ("99999999999.99", "19"), ("7.50", "7"), ("-7.50", "7"),
]:
    vat_cases.append({"taxable": t, "rate": rate, "expected": text(vat(t, rate))})

# ------------------------------------------------------------
# 5. Generate 2,000 random invoice line calculations
# ------------------------------------------------------------
# The random seed makes the results reproducible.
#
# Using the same seed means the same test values are generated
# every time the script runs.
#
# We include negative and positive quantities, different prices
# and different decimal scales to test many combinations.
rng = random.Random(20261117)
random_lines = []
for _ in range(2000):
    q = Decimal(rng.randint(-50000, 50000)).scaleb(-rng.randint(0, 4))
    p = Decimal(rng.randint(0, 10**7)).scaleb(-rng.randint(0, 6))
    random_lines.append({"quantity": text(q), "unitPrice": text(p), "charges": [], "allowances": [], "expected": text(line(q, p))})
# ------------------------------------------------------------
# 6. Generate 2,000 random VAT calculations
# ------------------------------------------------------------
# Test different taxable amounts and VAT percentages.
#
# These rates are test inputs, not a list of German VAT rates.
# They help test the calculation under different conditions.
random_vat = []
for _ in range(2000):
    t = Decimal(rng.randint(-10**8, 10**8)).scaleb(-2)
    rate = rng.choice(["19", "7", "16", "5", "0", "10", "20", "21", "25"])
    random_vat.append({"taxable": text(t), "rate": rate, "expected": text(vat(t, rate))})

# ------------------------------------------------------------
# 7. Format the generated test data as JSON
# ------------------------------------------------------------
# Fixed examples are written one per line for readability.
# Random examples are stored more compactly to reduce file size.
#
# randomLine = [quantity, unitPrice, expected]
# randomVat  = [taxable, rate, expected]
def one_per_line(items):
    return "[\n" + ",\n".join("  " + json.dumps(i, ensure_ascii=False) for i in items) + "\n ]"


def packed(rows, per_line=25):
    chunks = [rows[i:i + per_line] for i in range(0, len(rows), per_line)]
    return "[\n" + ",\n".join("  " + ", ".join(json.dumps(r, separators=(",", ":")) for r in chunk) for chunk in chunks) + "\n ]"


# ------------------------------------------------------------
# 8. Build and print the final JSON
# ------------------------------------------------------------
# This JSON is saved in the repository and read by decimal.test.ts.
#
# The comment identifies how the data was generated.
# The numerical results must not be edited manually.
parts = [
    ' "_comment": ' + json.dumps("Generated by core/utils/test/rounding-vectors.py (Python decimal, ROUND_HALF_UP = half away from zero). Do not edit by hand. randomLine rows: [quantity, unitPrice, expected]; randomVat rows: [taxable, rate, expected]."),
    ' "round": ' + one_per_line(round_cases),
    ' "line": ' + one_per_line(line_cases),
    ' "vat": ' + one_per_line(vat_cases),
    ' "randomLine": ' + packed([[c["quantity"], c["unitPrice"], c["expected"]] for c in random_lines]),
    ' "randomVat": ' + packed([[c["taxable"], c["rate"], c["expected"]] for c in random_vat]),
]
print("{\n" + ",\n".join(parts) + "\n}")
