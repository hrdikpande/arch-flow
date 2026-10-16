/**
 * Calendar helpers. All calendar dates are 'YYYY-MM-DD' strings in IST.
 * Working days exclude weekend days and holidays from the firm calendar.
 * The weekend pattern and holiday list are NOT confirmed yet (open item O-A1),
 * so they are configuration, with Saturday and Sunday as the placeholder.
 */

export const IST_OFFSET_MINUTES = 330; // UTC+05:30, India does not use DST

export interface CalendarOptions {
  /** Holiday dates, 'YYYY-MM-DD'. */
  holidays?: ReadonlySet<string>;
  /** Weekend days, 0 = Sunday ... 6 = Saturday. Placeholder until confirmed (O-A1). */
  weekendDays?: readonly number[];
}

const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assertCalendarDate(value: string): void {
  if (!DATE_RE.test(value)) {
    throw new RangeError(`Expected a YYYY-MM-DD date, got "${value}"`);
  }
  const parsed = parseCalendarDate(value);
  if (formatCalendarDate(parsed) !== value) {
    throw new RangeError(`"${value}" is not a real calendar date`);
  }
}

export function parseCalendarDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y as number, (m as number) - 1, d as number));
}

export function formatCalendarDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** The IST calendar date of an instant. */
export function istDateOf(instant: Date): string {
  return formatCalendarDate(new Date(instant.getTime() + IST_OFFSET_MINUTES * 60_000));
}

/** Last instant of an IST calendar day, as an ISO string with the +05:30 offset. */
export function endOfIstDay(date: string): string {
  assertCalendarDate(date);
  return `${date}T23:59:59+05:30`;
}

export function isWorkingDay(date: string, options: CalendarOptions = {}): boolean {
  assertCalendarDate(date);
  const weekend = options.weekendDays ?? [0, 6];
  const dayOfWeek = parseCalendarDate(date).getUTCDay();
  if (weekend.includes(dayOfWeek)) return false;
  if (options.holidays?.has(date)) return false;
  return true;
}

/**
 * The calendar date that is `count` working days after `start`.
 * Counting starts the day after `start`, so a same-day start is not counted.
 */
export function addWorkingDays(start: string, count: number, options: CalendarOptions = {}): string {
  assertCalendarDate(start);
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError('count must be a non-negative integer');
  }
  let cursor = parseCalendarDate(start);
  let remaining = count;
  while (remaining > 0) {
    cursor = new Date(cursor.getTime() + DAY_MS);
    if (isWorkingDay(formatCalendarDate(cursor), options)) remaining -= 1;
  }
  return formatCalendarDate(cursor);
}

/** Number of working days after `from` up to and including `to`. Zero if `to` is not after `from`. */
export function workingDaysBetween(from: string, to: string, options: CalendarOptions = {}): number {
  assertCalendarDate(from);
  assertCalendarDate(to);
  if (to <= from) return 0;
  let count = 0;
  let cursor = parseCalendarDate(from);
  const end = parseCalendarDate(to);
  while (cursor < end) {
    cursor = new Date(cursor.getTime() + DAY_MS);
    if (isWorkingDay(formatCalendarDate(cursor), options)) count += 1;
  }
  return count;
}
