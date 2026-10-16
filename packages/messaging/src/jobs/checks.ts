/**
 * Overdue RFI and stale-revision checks (FEATURES RFI-04, DSH stale-revision risk).
 * Each check records an event once per item, so the fan-out turns it into a WhatsApp message
 * only when the admin has switched that event type on.
 */

import { istDateOf } from '@arch-flow/domain';
import type { Clock } from '../ports';

export interface OverdueRfi { id: string; projectId: string; projectCode: string; number: string; dueDate: string; }
export interface StaleCandidate { sheetId: string; projectId: string; projectCode: string; sheet: string; issuedRev: string; sentRev: string; }

export interface ChecksPort {
  overdueRfis(today: string): Promise<OverdueRfi[]>;
  rfiOverdueNoticeToday(rfiId: string, today: string): Promise<boolean>;
  staleCandidates(): Promise<StaleCandidate[]>;
  staleNoticeRecorded(sheetId: string, issuedRev: string): Promise<boolean>;
  recordEvent(event: { type: string; projectId: string | null; entityType: string; entityId: string; payload: Record<string, unknown> }): Promise<void>;
}

export async function runOverdueRfiCheck(deps: { checks: ChecksPort; clock: Clock }): Promise<number> {
  const today = istDateOf(deps.clock.now());
  let count = 0;
  for (const rfi of await deps.checks.overdueRfis(today)) {
    if (await deps.checks.rfiOverdueNoticeToday(rfi.id, today)) continue;
    const days = workingDaysLate(rfi.dueDate, today);
    await deps.checks.recordEvent({
      type: 'rfi.overdue',
      projectId: rfi.projectId,
      entityType: 'rfi',
      entityId: rfi.id,
      payload: { number: rfi.number, projectCode: rfi.projectCode, days, path: `/projects/${rfi.projectCode}/issues` },
    });
    count += 1;
  }
  return count;
}

/** Calendar-day count for the message; the rule itself uses working days elsewhere. */
function workingDaysLate(due: string, today: string): number {
  return Math.max(0, Math.round((Date.parse(today) - Date.parse(due)) / 86_400_000));
}

/**
 * Stale revision: a newer revision is issued for a sheet, but the transmittal that
 * was last sent still carries an older revision. The newer one has not gone out.
 */
export async function runStaleRevisionCheck(deps: { checks: ChecksPort; clock: Clock }): Promise<number> {
  let count = 0;
  for (const candidate of await deps.checks.staleCandidates()) {
    if (await deps.checks.staleNoticeRecorded(candidate.sheetId, candidate.issuedRev)) continue;
    await deps.checks.recordEvent({
      type: 'sheet.stale_revision',
      projectId: candidate.projectId,
      entityType: 'sheet',
      entityId: candidate.sheetId,
      payload: { sheet: candidate.sheet, rev: candidate.issuedRev, sentRev: candidate.sentRev, projectCode: candidate.projectCode, path: `/projects/${candidate.projectCode}/sheets/${candidate.sheet}` },
    });
    count += 1;
  }
  return count;
}
