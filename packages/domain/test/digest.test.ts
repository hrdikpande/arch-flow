import { describe, expect, it } from 'vitest';
import { buildDeterministicDigest, DIGEST_MAX_CHARS, DigestInput } from '../src/digest';

const base: DigestInput = {
  date: '2026-10-17',
  uploads: 12,
  decisions: 2,
  issued: [{ project: 'NRH-BLR-01', sheet: 'M-101', rev: 'R2' }],
  waitingOnYou: 2,
  overdueSheets: 4,
  overdueRfis: 1,
  overdueReviews: 0,
  overdueSubmittals: 0,
  dueToday: 6,
  openCriticalClashes: 2,
  openCriticalRfis: 0,
  yourItems: ['M-101 R2 approval'],
  dashboardUrl: 'https://arch-flow.example/dashboard',
};

describe('deterministic digest (DIG-03)', () => {
  it('contains each section in order and the dashboard link', () => {
    const { text, truncated } = buildDeterministicDigest(base);
    expect(truncated).toBe(false);
    expect(text.split('\n')[0]).toBe('Morning digest, 2026-10-17, 9:00 AM IST');
    expect(text).toContain('Since last digest: 12 uploads, 1 issued revisions, 2 decisions');
    expect(text).toContain('  - NRH-BLR-01 M-101 R2 issued');
    expect(text).toContain('Waiting on you: 2 approvals');
    expect(text).toContain('Due today: 6 items');
    expect(text.endsWith('Dashboard: https://arch-flow.example/dashboard')).toBe(true);
  });

  it('leaves out empty optional sections', () => {
    const { text } = buildDeterministicDigest({ ...base, waitingOnYou: 0, dueToday: 0, issued: [], yourItems: [] });
    expect(text).not.toContain('Waiting on you');
    expect(text).not.toContain('Due today');
    expect(text).not.toContain('Your items');
  });

  it('shows the owner-only conflict line only when provided', () => {
    expect(buildDeterministicDigest({ ...base, overdueClientConflicts: 1 }).text).toContain('Client conflicts overdue: 1');
    expect(buildDeterministicDigest(base).text).not.toContain('Client conflicts overdue');
  });

  it('marks a late digest', () => {
    expect(buildDeterministicDigest({ ...base, sentLate: true }).text.split('\n')[0]).toContain('(Sent late)');
  });

  it('stays within the length limit for very large input (DIG-08)', () => {
    const issued = Array.from({ length: 300 }, (_, i) => ({ project: 'NRH-BLR-01', sheet: `M-${i}`, rev: 'R1' }));
    const yourItems = Array.from({ length: 80 }, (_, i) => `Approval for sheet ${i} awaiting decision`);
    const { text, truncated } = buildDeterministicDigest({ ...base, issued, yourItems });
    expect(truncated).toBe(true);
    expect(text.length).toBeLessThanOrEqual(DIGEST_MAX_CHARS);
    expect(text).toContain('See dashboard for the rest.');
    expect(text.endsWith('Dashboard: https://arch-flow.example/dashboard')).toBe(true);
  });
});
