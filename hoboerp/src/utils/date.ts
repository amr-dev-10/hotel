export function compactDate(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  if (!raw) {
    return '';
  }
  return raw.includes('T') ? raw.split('T')[0] : raw;
}
