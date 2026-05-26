/**
 * Date utilities. All inputs/outputs are ISO YYYY-MM-DD strings.
 * We deliberately avoid Date objects with implicit timezone behavior
 * — week math is done on the string + a UTC date constructor.
 */

const MS_PER_DAY = 86_400_000;

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Parse 'YYYY-MM-DD' to a UTC Date at midnight. */
function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Format a UTC Date as ISO YYYY-MM-DD. */
function toIso(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Format an ISO date as "May 4". Empty string for null/undefined. */
export function formatMonthDay(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = parseIso(iso);
  return `${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/**
 * Days the target is past today. Null when target is today, future,
 * or missing.
 */
export function daysOver(
  targetIso: string | null,
  todayIso: string,
): number | null {
  if (!targetIso) return null;
  const target = parseIso(targetIso).getTime();
  const today = parseIso(todayIso).getTime();
  const diff = Math.floor((today - target) / MS_PER_DAY);
  return diff > 0 ? diff : null;
}

/**
 * Weekly ticks from start to end (inclusive on both ends). Each tick is
 * 7 days after the previous. Used for the Gantt date axis.
 */
export function weeklyTicks(startIso: string, endIso: string): string[] {
  const start = parseIso(startIso);
  const end = parseIso(endIso);
  const ticks: string[] = [];
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 7 * MS_PER_DAY)) {
    ticks.push(toIso(d));
  }
  // Ensure the last tick covers (or exceeds) the end date.
  if (ticks.length === 0 || ticks[ticks.length - 1] < endIso) {
    const last = parseIso(ticks[ticks.length - 1] ?? startIso);
    ticks.push(toIso(new Date(last.getTime() + 7 * MS_PER_DAY)));
  }
  return ticks;
}

/** Today as ISO YYYY-MM-DD in the user's local timezone. */
export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
