/** Maximum absolute difference allowed between a computed and stated monetary amount. */
export const TOLERANCE = 0.01;

// to prevent this kinda situation
// example) 0.1 + 0.2 // 0.30000000000000004
export function isClose(a: number, b: number, tolerance = TOLERANCE): boolean {
  return Math.abs(a - b) <= tolerance;
}

// example)
// round2(19.999); // 20
// round2(19.994); // 19.99
// round2(123.4567); // 123.46
// 123.4567 * 100
// 12345.67
// Math.round(12345.67)
// 12346
// 12346 / 100
// 123.46
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
