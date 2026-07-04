export function currency(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const number = Number(value);
  return Number.isNaN(number) ? String(value) : `₹${number.toFixed(2)}`;
}
