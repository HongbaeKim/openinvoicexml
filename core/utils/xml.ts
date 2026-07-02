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
