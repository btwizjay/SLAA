// SLAA ID: A26-000123-4 (type letter, year, serial, Luhn check digit).
// checkDigit() must give the same answer as slaa_check_digit() in SQL.

export const SLAA_ID_REGEX = /^[ACO][0-9]{2}-[0-9]{6}-[0-9]$/;

export function checkDigit(body: string): number {
  const digits = body.replace(/\D/g, "");
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const d = Number(digits[i]);
    // double every second digit counting from the right, starting with the last
    if ((digits.length - (i + 1)) % 2 === 0) {
      const x = d * 2;
      sum += Math.floor(x / 10) + (x % 10);
    } else {
      sum += d;
    }
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidSlaaId(id: string): boolean {
  const v = id.trim().toUpperCase();
  if (!SLAA_ID_REGEX.test(v)) return false;
  return checkDigit(v.slice(0, 10)) === Number(v[11]);
}
