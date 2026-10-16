import { describe, expect, it } from 'vitest';
import { runOverdueRfiCheck, runStaleRevisionCheck, type ChecksPort } from '../src/jobs/checks';
import { FakeClock } from './fakes';

const T0 = new Date('2026-10-20T04:00:00Z'); // 09:30 IST on 20 Oct

function fakeChecks(overrides: Partial<ChecksPort> = {}): ChecksPort & { events: { type: string; entityId: string }[] } {
  const events: { type: string; entityId: string }[] = [];
  return {
    events,
    async overdueRfis() { return [{ id: 'rfi-1', projectId: 'p1', projectCode: 'NRH-BLR-01', number: 'RFI-007', dueDate: '2026-10-16' }]; },
    async rfiOverdueNoticeToday() { return false; },
    async staleCandidates() { return []; },
    async staleNoticeRecorded() { return false; },
    async recordEvent(event) { events.push({ type: event.type, entityId: event.entityId }); },
    ...overrides,
  };
}

describe('overdue RFI check (RFI-04)', () => {
  it('records one overdue event per RFI per day', async () => {
    const checks = fakeChecks();
    expect(await runOverdueRfiCheck({ checks, clock: new FakeClock(T0) })).toBe(1);
    expect(checks.events).toEqual([{ type: 'rfi.overdue', entityId: 'rfi-1' }]);
  });

  it('does not repeat the event the same day', async () => {
    const checks = fakeChecks({ rfiOverdueNoticeToday: async () => true });
    expect(await runOverdueRfiCheck({ checks, clock: new FakeClock(T0) })).toBe(0);
    expect(checks.events).toHaveLength(0);
  });
});

describe('stale-revision check (FIL-05)', () => {
  it('records a stale event once for the issued revision that has not been sent', async () => {
    const checks = fakeChecks({
      staleCandidates: async () => [{ sheetId: 's1', projectId: 'p1', projectCode: 'NRH-BLR-01', sheet: 'M-101', issuedRev: 'R2', sentRev: 'R1' }],
    });
    expect(await runStaleRevisionCheck({ checks, clock: new FakeClock(T0) })).toBe(1);
    expect(checks.events).toEqual([{ type: 'sheet.stale_revision', entityId: 's1' }]);
  });

  it('does not record again for the same issued revision', async () => {
    const checks = fakeChecks({
      staleCandidates: async () => [{ sheetId: 's1', projectId: 'p1', projectCode: 'NRH-BLR-01', sheet: 'M-101', issuedRev: 'R2', sentRev: 'R1' }],
      staleNoticeRecorded: async () => true,
    });
    expect(await runStaleRevisionCheck({ checks, clock: new FakeClock(T0) })).toBe(0);
  });
});
