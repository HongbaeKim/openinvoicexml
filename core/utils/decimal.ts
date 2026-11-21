
/**
 * Exact decimal arithmetic for money using native BigInt.
 * No external dependencies are required.
 *
 * Simple explanation:
 * JavaScript sometimes makes small calculation errors with decimal numbers.
 * For example, 30 × 0.0055 should be 0.165, which rounds to 0.17.
 * However, normal JavaScript floating-point calculations can round
 * this incorrectly to 0.16.
 *
 * This utility avoids that problem by storing decimal values as
 * integers (BigInt) together with their decimal scale.
 *
 * Example:
 *   0.165 = 165 / 1000
 *   units = 165
 *   scale = 3
 *
 * This allows accurate calculations before rounding the final result.
 *
 * Technical details:
 *
 * Why BigInt:
 * JavaScript numbers use binary floating-point arithmetic.
 * For example, `30 * 0.0055 * 100` produces `16.499999999999996`,
 * so `Math.round(...) / 100` incorrectly returns 0.16.
 *
 * BigInt avoids these floating-point errors by representing values
 * as integers with a decimal scale:
 *
 *   value = units / 10^scale
 *
 * Addition and multiplication remain exact at the represented scale.
 * Rounding is performed only when explicitly requested.
 *
 * Rounding method:
 * Half away from zero:
 *   0.165  →  0.17
 *  -0.165  → -0.17
 *
 * For positive values, this matches commercial rounding and the XPath
 * round() behavior used in relevant KoSIT/EN 16931 Schematron rules.
 *
 * For negative values, it keeps rounding symmetric with positive amounts.
 * This is consistent with rules such as BR-S-09 and BR-CO-17, which
 * round the absolute VAT amount.
 *
 * Input handling:
 * The Invoice API accepts JavaScript numbers.
 * fromNumber() converts them using String(n), which produces the
 * shortest decimal representation that round-trips to the same number.
 *
 * For example, 0.0055 is interpreted as the decimal value 0.0055,
 * rather than its underlying binary floating-point approximation.
 *
 * Exponent notation such as 1e-7 and 1e+21 is also supported.
 *
 * Limitation:
 * JavaScript numbers have approximately 15–17 significant digits
 * of precision. If an input has already lost precision before
 * reaching this utility, BigInt cannot recover the lost digits.
 */

/**
 * Represents an exact decimal number using BigInt.
 *
 * Instead of storing 0.165 as a floating-point number,
 * we store it as an integer (165) and a decimal scale (3).
 *
 * Example:
 *   { units: 165n, scale: 3 } = 0.165
 *   { units: 17n, scale: 2 } = 0.17
 *
 * Formula: value = units / 10^scale
 */
export interface Decimal {
  /** The integer containing all digits of the decimal value. */
  readonly units: bigint;

  /** Number of digits after the decimal point (0 or greater). */
  readonly scale: number;
}

/**
 * Maximum supported exponent.
 *
 * Prevents extremely large powers of ten from consuming too much memory.
 * JavaScript numbers can represent exponents down to about -324,
 * so 1000 is a generous limit for ordinary numeric inputs.
 */
const MAX_EXPONENT = 1000;

/**
 * Stores powers of ten so they do not have to be recalculated.
 *
 * Example:
 *   POW10[0] = 1n
 *   POW10[1] = 10n
 *   POW10[2] = 100n
 *
 * The array grows only when a larger power is needed.
 */
const POW10: bigint[] = [1n];

function pow10(n: number): bigint {
  for (let i = POW10.length; i <= n; i++)
    POW10.push(POW10[i - 1]! * 10n);
  return POW10[n]!;
}

/**
 * Creates a Decimal with a non-negative scale.
 *
 * A negative scale means the decimal point must move right.
 *
 * Example:
 *   make(15n, -2) = { units: 1500n, scale: 0 }
 *   This represents 1500.
 */
function make(units: bigint, scale: number): Decimal {
  if (scale >= 0) return { units, scale };
  return { units: units * pow10(-scale), scale: 0 };
}

/**
 * Recognizes supported decimal number formats.
 *
 * Examples:
 *   "12.50", "-12", "0.0055", ".5", "1.5e3", "1e-7"
 *
 * Rejects invalid formats such as commas, spaces and multiple dots.
 */
const PATTERN =
  /^([+-])?(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$|^([+-])?\.(\d+)(?:[eE]([+-]?\d+))?$/;

/**
 * Converts a decimal string into an exact Decimal.
 *
 * Example:
 *   parseDecimal("0.0055")
 *   → { units: 55n, scale: 4 }
 *
 * Scientific notation is also supported:
 *   parseDecimal("1.5e3") → 1500
 *   parseDecimal("1e-7")  → 0.0000001
 *
 * Throws an error for invalid input or exponents outside ±1000.
 */
export function parseDecimal(text: string): Decimal {
  const m = PATTERN.exec(text);
  if (!m) throw new Error(`not a decimal number: "${text}"`);

  const sign = m[1] ?? m[5] ?? "";
  const whole = m[2] ?? "0";
  const fraction = m[3] ?? m[6] ?? "";
  const exponent = Number(m[4] ?? m[7] ?? "0");

  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > MAX_EXPONENT) {
    throw new Error(`exponent out of range: "${text}"`);
  }

  const digits = BigInt(`${whole}${fraction}`);
  return make(sign === "-" ? -digits : digits, fraction.length - exponent);
}

/**
 * Converts a JavaScript number into a Decimal.
 *
 * Example:
 *   fromNumber(0.0055) → { units: 55n, scale: 4 }
 *
 * String(value) gives the shortest decimal text that round-trips
 * to the same JavaScript number, avoiding calculations directly
 * on its binary floating-point representation.
 *
 * NaN and Infinity are rejected.
 *
 * Note: precision already lost in the input number cannot be restored.
 * 
 * 9,007,199,254,740,991 (2^53 − 1) is the largest integer that can be represented exactly in a JavaScript number.
 * Larger integers will be rounded to the nearest representable value.
 * For example, 9007199254740993 is represented as 9007199254740992.
 */
export function fromNumber(value: number): Decimal {
  if (!Number.isFinite(value))
    throw new Error(`not a finite number: ${value}`);

  return parseDecimal(String(value)); // String(-0) === "0"
}

/**
 * Makes two decimals use the same scale before comparison or addition.
 *
 * Example:
 *   1.2  = { units: 12n, scale: 1 }
 *   0.03 = { units: 3n, scale: 2 }
 *
 * After alignment:
 *   1.20 = { units: 120n, scale: 2 }
 *   0.03 = { units: 3n, scale: 2 }
 *
 * Returns both aligned integers and their common scale.
 */
function align(a: Decimal, b: Decimal): [bigint, bigint, number] {
  if (a.scale === b.scale) return [a.units, b.units, a.scale];
  if (a.scale > b.scale)
    return [a.units, b.units * pow10(a.scale - b.scale), a.scale];
  return [a.units * pow10(b.scale - a.scale), b.units, b.scale];
}

/**
 * Adds two decimal values exactly.
 *
 * Example: 1.20 + 0.03 = 1.23
 */
export function add(a: Decimal, b: Decimal): Decimal {
  const [x, y, scale] = align(a, b);
  return { units: x + y, scale };
}

/**
 * Subtracts one decimal value from another exactly.
 *
 * Example: 1.20 - 0.03 = 1.17
 */
export function sub(a: Decimal, b: Decimal): Decimal {
  const [x, y, scale] = align(a, b);
  return { units: x - y, scale };
}

/**
 * Multiplies two decimals exactly.
 *
 * The integer values are multiplied, and their scales are added.
 *
 * Example:
 *   0.5 × 0.5 = 0.25
 *
 *   5 × 5 = 25 (integer units)
 *   1 + 1 = 2 (decimal scale)
 */
export function mul(a: Decimal, b: Decimal): Decimal {
  return { units: a.units * b.units, scale: a.scale + b.scale };
}

/**
 * Adds all decimals in an array.
 *
 * Example: [1.20, 0.30, 0.50] → 2.00
 *
 * An empty array returns zero.
 */
export function sum(values: readonly Decimal[]): Decimal {
  return values.reduce(add, ZERO);
}

/**
 * Divides a decimal by 10^n without rounding.
 *
 * This simply moves the decimal point to the left.
 *
 * Example:
 *   150 / 100 = 1.50
 *   shiftLeft(parseDecimal("150"), 2) → 1.50
 */
export function shiftLeft(a: Decimal, n: number): Decimal {
  return { units: a.units, scale: a.scale + n };
}

/**
 * Changes the sign of a decimal.
 *
 * Examples:
 *    1.50 → -1.50
 *   -1.50 →  1.50
 */
export function negate(a: Decimal): Decimal {
  return { units: -a.units, scale: a.scale };
}

/**
 * Compares two decimals.
 *
 * Returns:
 *   -1 if a < b
 *    0 if a = b
 *    1 if a > b
 *
 * Example: compare(1.20, 1.30) → -1
 */
export function compare(a: Decimal, b: Decimal): number {
  const [x, y] = align(a, b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * Returns the absolute value (always non-negative).
 *
 * Examples:
 *   abs(-1.50) → 1.50
 *   abs(1.50)  → 1.50
 */
export function abs(a: Decimal): Decimal {
  return a.units < 0n ? negate(a) : a;
}

/**
 * Rounds a decimal to the requested number of places.
 *
 * Uses "half away from zero":
 *   0.165  →  0.17
 *  -0.165  → -0.17
 *   0.164  →  0.16
 *
 * How it works:
 * 1. Find the digits to remove.
 * 2. Divide the integer units by the corresponding power of ten.
 * 3. Check the remainder to decide whether to round.
 * 4. If exactly halfway, round away from zero.
 *
 * BigInt division truncates toward zero, so negative numbers
 * need explicit handling to round symmetrically.
 *
 * Values already at or below the requested scale are kept exact,
 * with zeros added when necessary.
 */
export function roundHalfAwayFromZero(
  a: Decimal,
  places: number,
): Decimal {
  if (!Number.isInteger(places) || places < 0)
    throw new Error(`invalid number of places: ${places}`);

  if (a.scale <= places)
    return { units: a.units * pow10(places - a.scale), scale: places };

  const divisor = pow10(a.scale - places);
  const quotient = a.units / divisor; // BigInt division truncates towards zero
  const remainder = a.units % divisor; // Same sign as units
  const twice = (remainder < 0n ? -remainder : remainder) * 2n;

  if (twice >= divisor)
    return {
      units: quotient + (a.units < 0n ? -1n : 1n),
      scale: places,
    };

  return { units: quotient, scale: places };
}

/**
 * Converts a Decimal into a string without losing precision.
 *
 * Keeps exactly the number of decimal places in its scale.
 *
 * Examples:
 *   { units: 123n, scale: 2 } → "1.23"
 *   { units: -17n, scale: 2 } → "-0.17"
 *   { units: 5n, scale: 3 }   → "0.005"
 *
 * Never uses exponent notation or outputs "-0".
 */
export function toText(a: Decimal): string {
  const negative = a.units < 0n;
  const digits = (negative ? -a.units : a.units)
    .toString()
    .padStart(a.scale + 1, "0");

  const whole = a.scale === 0 ? digits : digits.slice(0, -a.scale);
  const fraction = a.scale === 0 ? "" : `.${digits.slice(-a.scale)}`;

  return `${negative ? "-" : ""}${whole}${fraction}`;
}

/**
 * Rounds a decimal and formats it with exactly the requested places.
 *
 * Useful when generating invoice amounts in XML.
 *
 * Example:
 *   toFixedText(parseDecimal("0.165"), 2) → "0.17"
 */
export function toFixedText(a: Decimal, places: number): string {
  return toText(roundHalfAwayFromZero(a, places));
}

/**
 * Converts a Decimal back to a JavaScript number.
 *
 * Used when returning calculated amounts through the public API.
 *
 * Example:
 *   { units: 125n, scale: 2 } → 1.25
 *
 * Note: the conversion returns a JavaScript floating-point number,
 * so the decimal value is not guaranteed to remain exactly
 * representable in binary.
 *
 * For exact decimal output, prefer toText() or toFixedText().
 */
export function toNumber(a: Decimal): number {
  return Number(toText(a));
}

/**
 * Reusable decimal zero.
 *
 * Represents the number 0 without decimal places.
 * Used as the starting value when summing decimal amounts.
 */
export const ZERO: Decimal = { units: 0n, scale: 0 };
