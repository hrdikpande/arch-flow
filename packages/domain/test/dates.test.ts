import { describe, expect, it } from 'vitest';
import { addWorkingDays, assertCalendarDate, endOfIstDay, istDateOf, workingDaysBetween } from '../src/dates';

describe('working days', () => {
  it('skips weekends by default (Sat and Sun)', () => {
    // 2026-10-16 is a Friday. Two working days later is Tuesday 2026-10-20.
    expect(addWorkingDays('2026-10-16', 2)).toBe('2026-10-20');
  });

  it('skips holidays from the calendar', () => {
    const holidays = new Set(['2026-10-19']); // Monday holiday
    expect(addWorkingDays('2026-10-16', 2, { holidays })).toBe('2026-10-21');
  });

  it('counts from the next day, not the start day', () => {
    expect(addWorkingDays('2026-10-19', 1)).toBe('2026-10-20'); // Monday -> Tuesday
    expect(addWorkingDays('2026-10-17', 0)).toBe('2026-10-17');
  });

  it('respects a custom weekend pattern (O-A1 placeholder)', () => {
    // Friday and Saturday weekend: Thursday 2026-10-15 + 1 working day = Sunday 2026-10-18
    expect(addWorkingDays('2026-10-15', 1, { weekendDays: [5, 6] })).toBe('2026-10-18');
  });

  it('counts working days between two dates', () => {
    expect(workingDaysBetween('2026-10-16', '2026-10-23')).toBe(5); // Mon 19 .. Fri 23
    expect(workingDaysBetween('2026-10-23', '2026-10-16')).toBe(0);
    expect(workingDaysBetween('2026-10-16', '2026-10-16')).toBe(0);
  });

  it('rejects impossible dates', () => {
    expect(() => assertCalendarDate('2026-02-30')).toThrow();
    expect(() => assertCalendarDate('16/10/2026')).toThrow();
    expect(() => addWorkingDays('2026-10-16', -1)).toThrow();
  });
});

describe('IST handling', () => {
  it('gives the IST date for an instant just after UTC midnight', () => {
    // 2026-10-16T19:00Z is 2026-10-17 00:30 IST
    expect(istDateOf(new Date('2026-10-16T19:00:00Z'))).toBe('2026-10-17');
    expect(istDateOf(new Date('2026-10-16T18:00:00Z'))).toBe('2026-10-16');
  });

  it('ends an IST day at 23:59:59 with the +05:30 offset', () => {
    expect(endOfIstDay('2026-10-20')).toBe('2026-10-20T23:59:59+05:30');
  });
});
