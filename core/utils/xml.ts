import { MAX_UNIT_PRICE_DECIMALS } from "./monetary.js";

//Escape function
//ampersand
//lsee than
//greater than
//quotation mark
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// example of Ammount
// const x = 10.5;
// x.toFixed(2);
// retuens "10.50" as a string
export function amt(value: number): string {
  return value.toFixed(2);
}

// Unit price (BT-146): always uses at least 2 decimal places, but keeps extra decimals
// when needed. Unlike amt(), it does not round every value to 2 decimals.
//
// Examples:
//   price(125)      -> "125.00"
//   price(12.5)     -> "12.50"
//   price(0.5)      -> "0.50"
//   price(0.0055)   -> "0.0055"
//   price(1.2345)   -> "1.2345"
//
// This is important because amt(0.0055) would write "0.01", which would change the
// actual unit price. Unit prices (BT-146) are allowed to have more than 2 decimals.
export function price(value: number): string {
  return value.toFixed(MAX_UNIT_PRICE_DECIMALS).replace(/(\.\d\d\d*?)0+$/, "$1");
}
