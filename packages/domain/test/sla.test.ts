import { describe, expect, it } from 'vitest';
import { conflictDueAt, isEscalationDue, workingDaysOverdue, workingDaysToDue } from '../src/sla';

describe('SLAs in working days (decisions 14, 26)', () => {
  it('gives a conflict raised on Friday a reply due Wednesday at end of day (3 working days)', () => {
    expect(conflictDueAt('2026-10-16')).toBe('2026-10-21T23:59:59+05:30');
  });

  it('uses a per-project override when given', () => {
    expect(conflictDueAt('2026-10-16', { conflict_reply: 5 })).toBe('2026-10-23T23:59:59+05:30');
  });

  it('escalates approvals after 2 working days', () => {
    expect(isEscalationDue('2026-10-16', '2026-10-19', 2)).toBe(false); // Mon 19 is 1 working day
    expect(isEscalationDue('2026-10-16', '2026-10-20', 2)).toBe(true);
  });

  it('reports days to due and days overdue', () => {
    expect(workingDaysToDue('2026-10-20', '2026-10-16')).toBe(2);
    expect(workingDaysToDue('2026-10-16', '2026-10-20')).toBe(-2);
    expect(workingDaysOverdue('2026-10-16', '2026-10-16')).toBe(0);
    expect(workingDaysOverdue('2026-10-16', '2026-10-20')).toBe(2);
  });
});
