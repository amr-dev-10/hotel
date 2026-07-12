import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { slaForDepartment } from '../utils/constants';

export interface HotelDepartment {
  id: string;
  name: string;
  key: string;
  description: string;
  keywords: string[];
  resolutionTime?: string;
  resolutionMinutes?: number;
}

// In-process cache per hotel { hotelId -> { ts, departments } }
const cache: Record<string, { ts: number; departments: HotelDepartment[] }> = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch this hotel's department configuration from Firestore.
 * Results are cached for 5 minutes to avoid redundant reads.
 */
export async function fetchHotelDepartments(hotelId: string): Promise<HotelDepartment[]> {
  if (!hotelId) return [];
  const cached = cache[hotelId];
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.departments;

  try {
    const snap = await getDocs(collection(db, 'hotels', hotelId, 'departments'));
    const list: HotelDepartment[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<HotelDepartment, 'id'>) }));
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    cache[hotelId] = { ts: Date.now(), departments: list };
    return list;
  } catch (e) {
    console.error('[departmentService] fetchHotelDepartments error:', e);
    return [];
  }
}

/** Invalidate the cache for a hotel (call after departments are edited). */
export function invalidateDepartmentCache(hotelId: string) {
  delete cache[hotelId];
}

/** Extract a minutes value from a department config doc, if present. */
function deptResolutionMinutes(dept: HotelDepartment): number | null {
  if (typeof dept.resolutionMinutes === 'number' && dept.resolutionMinutes > 0) {
    return dept.resolutionMinutes;
  }
  if (typeof dept.resolutionTime === 'string') {
    const m = dept.resolutionTime.match(/\d+/);
    if (m) return parseInt(m[0], 10);
  }
  return null;
}

/**
 * Resolve the time frame (in milliseconds) a ticket in this department is
 * expected to be completed within. Reads the hotel's department config
 * (`resolutionMinutes` / `resolutionTime`); falls back to the legacy
 * per-department SLA constants when the hotel has no config.
 */
export async function getDepartmentResolutionMs(
  hotelId: string,
  rawDepartment: string | null | undefined,
): Promise<number> {
  const fallback = slaForDepartment(rawDepartment);
  if (!hotelId || !rawDepartment) return fallback;
  try {
    const departments = await fetchHotelDepartments(hotelId);
    const needle = norm(rawDepartment);
    for (const dept of departments) {
      const matches =
        norm(dept.key) === needle ||
        norm(dept.name) === needle ||
        (Array.isArray(dept.keywords) && dept.keywords.some((kw) => norm(kw) === needle));
      if (matches) {
        const mins = deptResolutionMinutes(dept);
        if (mins != null) return mins * 60 * 1000;
        break;
      }
    }
  } catch {
    // fall through to the constant
  }
  return fallback;
}

const norm = (v: unknown) =>
  (v ?? '').toString().trim().toLowerCase().replace(/[\s_-]+/g, '');

// Maps normalized LLM/legacy variants → array of normalized canonical department
// key/name values they should match against.
const DEPT_ALIASES: Record<string, string[]> = {
  engineersupport:        ['engineering', 'maintenance', 'technical'],
  technicalsupport:       ['engineering', 'maintenance', 'technical'],
  maintenance:            ['engineering', 'technical'],
  maintainance:           ['engineering', 'technical'],
  technical:              ['engineering', 'maintenance'],
  foodbeveragesupport:    ['foodandbeverages', 'foodandbeverage', 'inroomdining', 'fnb', 'roomservice'],
  foodandbeveragesupport: ['foodandbeverages', 'foodandbeverage', 'inroomdining', 'fnb', 'roomservice'],
  order:                  ['foodandbeverages', 'foodandbeverage', 'inroomdining', 'fnb', 'roomservice'],
  inroomdining:           ['foodandbeverages', 'foodandbeverage', 'fnb', 'roomservice'],
  foodandbeverages:       ['foodandbeverage', 'inroomdining', 'fnb', 'roomservice'],
  foodandbeverage:        ['foodandbeverages', 'inroomdining', 'fnb', 'roomservice'],
  handlegeneralinquiries: ['frontdesk', 'reception'],
  emergencyresponse:      ['frontdesk', 'reception'],
  emergencyservices:      ['frontdesk', 'reception'],
  safety:                 ['frontdesk', 'reception'],
  bellmen:                ['bellman'],
};

/**
 * Resolve a raw department string (from a ticket or LLM) to the hotel's
 * canonical key. Matches against key, name, and keyword aliases.
 * Returns the original value unchanged if no match is found.
 */
export function resolveDepartmentKey(raw: string, departments: HotelDepartment[]): string {
  if (!raw || !departments.length) return raw;
  const needle = norm(raw);

  // Pass 1: Direct match against key, name, keywords
  for (const dept of departments) {
    if (norm(dept.key) === needle) return dept.key;
    if (norm(dept.name) === needle) return dept.key;
    if (Array.isArray(dept.keywords) && dept.keywords.some((kw) => norm(kw) === needle)) {
      return dept.key;
    }
  }

  // Pass 2: Alias fallback — map variant to known canonical names
  const aliases = DEPT_ALIASES[needle];
  if (aliases) {
    for (const dept of departments) {
      const dKey = norm(dept.key);
      const dName = norm(dept.name);
      if (aliases.includes(dKey) || aliases.includes(dName)) return dept.key;
      if (Array.isArray(dept.keywords) && dept.keywords.some((kw) => aliases.includes(norm(kw)))) {
        return dept.key;
      }
    }
  }

  return raw;
}

/**
 * Build { key, label } options for department picker dropdowns.
 * Falls back to the legacy hardcoded list when the hotel has no config.
 */
export function getDepartmentOptions(
  departments: HotelDepartment[],
  includeAll = false,
): { key: string; label: string }[] {
  const base: { key: string; label: string }[] =
    departments.length > 0
      ? departments.map((d) => ({ key: d.key, label: d.name }))
      : FALLBACK_DEPARTMENTS;

  if (includeAll) {
    return [{ key: 'ALL', label: 'All Departments' }, ...base];
  }
  return base;
}

/**
 * Sanitize a raw department value (e.g. from Firestore user doc) against the
 * hotel's department list. Falls back to 'ALL' if no match found.
 */
export function sanitizeDepartment(raw: unknown, departments: HotelDepartment[]): string {
  if (!raw) return 'ALL';
  const needle = norm(raw as string);

  if (departments.length > 0) {
    for (const dept of departments) {
      if (norm(dept.key) === needle) return dept.key;
      if (norm(dept.name) === needle) return dept.key;
      if (Array.isArray(dept.keywords) && dept.keywords.some((kw) => norm(kw) === needle)) {
        return dept.key;
      }
    }
    // Check for 'ALL' explicitly
    if (needle === 'all') return 'ALL';
    return 'ALL';
  }

  // Fallback: match against legacy hardcoded values
  const fallbackKeys = ['ALL', ...FALLBACK_DEPARTMENTS.map((d) => d.key)];
  const match = fallbackKeys.find((k) => norm(k) === needle);
  return match ?? 'ALL';
}

// Legacy fallback department list (used when hotel has no departments configured yet)
export const FALLBACK_DEPARTMENTS: { key: string; label: string }[] = [
  { key: 'Engineering',        label: 'Engineering' },
  { key: 'Food_and_beverages', label: 'Food & Beverages' },
  { key: 'Front_desk',         label: 'Front Desk' },
  { key: 'House_keeping',      label: 'House Keeping' },
];
