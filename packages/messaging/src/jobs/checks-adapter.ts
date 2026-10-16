/**
 * Database side of the overdue-RFI and stale-revision checks (ChecksPort).
 * Kept separate from the main adapter so each file stays readable.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChecksPort, OverdueRfi, StaleCandidate } from './checks';

type Row = Record<string, any>;

export function createChecksPort(db: SupabaseClient): ChecksPort {
  return {
    async overdueRfis(today: string): Promise<OverdueRfi[]> {
      const { data, error } = await db
        .from('rfis')
        .select('id, number, due_date, project_id, projects(code)')
        .eq('status', 'open')
        .lt('due_date', today);
      if (error) throw new Error(`overdue rfis: ${error.message}`);
      return ((data ?? []) as Row[]).map((r) => ({
        id: r.id,
        projectId: r.project_id,
        projectCode: r.projects?.code ?? '?',
        number: r.number,
        dueDate: r.due_date,
      }));
    },

    async rfiOverdueNoticeToday(rfiId: string, today: string): Promise<boolean> {
      const { data, error } = await db
        .from('events')
        .select('id')
        .eq('type', 'rfi.overdue')
        .eq('entity_id', rfiId)
        .gte('created_at', `${today}T00:00:00+05:30`)
        .limit(1);
      if (error) throw new Error(`rfi notice: ${error.message}`);
      return (data ?? []).length > 0;
    },

    /**
     * A sheet is stale when its current issued revision has not been sent yet, but an older
     * revision of the same sheet has been sent on a transmittal (the recipient is holding an old drawing).
     */
    async staleCandidates(): Promise<StaleCandidate[]> {
      const { data: sheets, error } = await db
        .from('sheets')
        .select('id, sheet_number, project_id, projects(code), current_revision_id, revisions:current_revision_id(id, rev_code, status)')
        .in('status', ['issued', 'gfc', 'ifc'])
        .not('current_revision_id', 'is', null);
      if (error) throw new Error(`stale candidates: ${error.message}`);
      const out: StaleCandidate[] = [];
      for (const sheet of (sheets ?? []) as Row[]) {
        const current = sheet.revisions as Row | null;
        if (!current || current.status !== 'issued') continue;
        const { data: revs, error: revsError } = await db.from('revisions').select('id, rev_code, seq').eq('sheet_id', sheet.id);
        if (revsError) throw new Error(`stale revisions: ${revsError.message}`);
        const revById = new Map(((revs ?? []) as Row[]).map((r) => [r.id as string, r]));
        const { data: items, error: itemsError } = await db
          .from('transmittal_items')
          .select('revision_id, transmittals(sent_at)')
          .in('revision_id', [...revById.keys()]);
        if (itemsError) throw new Error(`stale items: ${itemsError.message}`);
        const sent = ((items ?? []) as Row[])
          .filter((i) => i.transmittals?.sent_at && revById.has(i.revision_id))
          .map((i) => ({ revision_id: i.revision_id as string, revisions: revById.get(i.revision_id) as Row }));
        const currentSent = sent.some((i) => i.revision_id === current.id);
        const olderSent = sent.filter((i) => i.revisions.rev_code !== current.rev_code);
        if (!currentSent && olderSent.length > 0) {
          const latestSent = olderSent.sort((a, b) => (b.revisions.seq as number) - (a.revisions.seq as number))[0];
          out.push({
            sheetId: sheet.id,
            projectId: sheet.project_id,
            projectCode: sheet.projects?.code ?? '?',
            sheet: sheet.sheet_number,
            issuedRev: current.rev_code,
            sentRev: latestSent?.revisions.rev_code ?? '',
          });
        }
      }
      return out;
    },

    async staleNoticeRecorded(sheetId: string, issuedRev: string): Promise<boolean> {
      const { data, error } = await db
        .from('events')
        .select('id, payload')
        .eq('type', 'sheet.stale_revision')
        .eq('entity_id', sheetId)
        .limit(50);
      if (error) throw new Error(`stale notice: ${error.message}`);
      return ((data ?? []) as Row[]).some((e) => e.payload?.rev === issuedRev);
    },

    async recordEvent(event): Promise<void> {
      const { error } = await db.from('events').insert({
        type: event.type,
        project_id: event.projectId,
        entity_type: event.entityType,
        entity_id: event.entityId,
        payload: event.payload,
      });
      if (error) throw new Error(`record event: ${error.message}`);
    },
  };
}
