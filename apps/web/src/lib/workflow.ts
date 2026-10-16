/**
 * Shared workflow helpers for server actions: loading a sheet's state and the
 * transition context the domain rules need (LIFE-05, LIFE-08).
 */

import { addWorkingDays, endOfIstDay, slaDays, type Role, type SheetState, type TransitionContext } from '@arch-flow/domain';
import { slaOverridesFor, workingCalendar } from './settings';
import { adminDb } from './supabase/admin';
import type { Access } from './access';

export interface SheetRecord {
  id: string;
  project_id: string;
  sheet_number: string;
  title: string;
  discipline_code: string;
  status: SheetState;
  owner_id: string | null;
  due_date: string | null;
  current_revision_id: string | null;
}

export interface RevisionRecord {
  id: string;
  sheet_id: string;
  rev_code: string;
  seq: number;
  status: 'wip' | 'issued' | 'superseded';
  purpose: 'issued' | 'ifc' | 'gfc' | null;
}

export async function loadSheet(projectId: string, sheetNumber: string): Promise<SheetRecord | null> {
  const { data } = await adminDb()
    .from('sheets')
    .select('id, project_id, sheet_number, title, discipline_code, status, owner_id, due_date, current_revision_id')
    .eq('project_id', projectId)
    .eq('sheet_number', sheetNumber)
    .maybeSingle();
  return (data as SheetRecord | null) ?? null;
}

export async function revisionsOf(sheetId: string): Promise<RevisionRecord[]> {
  const { data } = await adminDb()
    .from('revisions')
    .select('id, sheet_id, rev_code, seq, status, purpose')
    .eq('sheet_id', sheetId)
    .order('seq', { ascending: true });
  return (data ?? []) as RevisionRecord[];
}

/** Roles the user holds on this project, as domain roles. Admin is reported as 'admin'. */
export function rolesFor(access: Access, projectId: string): Role[] {
  const roles: Role[] = [...(access.projectRoles.get(projectId) ?? [])];
  if (access.isAdmin) roles.push('admin');
  return roles;
}

export async function transitionContext(sheet: SheetRecord, reason?: string): Promise<TransitionContext> {
  const db = adminDb();
  const [{ data: checkers }, { data: clashLinks }, revisions] = await Promise.all([
    db.from('user_roles').select('user_id').eq('project_id', sheet.project_id).eq('role', 'checker').limit(1),
    db.from('clash_sheets').select('clashes(number, priority, status)').eq('sheet_id', sheet.id),
    revisionsOf(sheet.id),
  ]);
  const openCritical = (clashLinks ?? [])
    .map((row) => row.clashes as unknown as { number: string; priority: string; status: string } | null)
    .filter((c): c is { number: string; priority: string; status: string } => Boolean(c))
    .filter((c) => c.status === 'open' && c.priority === 'critical')
    .map((c) => c.number);
  const wip = revisions.find((r) => r.status === 'wip');
  const issued = revisions.filter((r) => r.status === 'issued');
  const maxIssuedSeq = issued.reduce((max, r) => Math.max(max, r.seq), -1);
  return {
    hasOwner: Boolean(sheet.owner_id),
    hasChecker: (checkers ?? []).length > 0,
    // A sheet reaches 'approved' only through checker sign-off (LIFE-04).
    checkerSignedOff: sheet.status === 'approved',
    openCriticalClashes: openCritical,
    transmittalSelected: false,
    newRevisionCreated: Boolean(wip && wip.seq > maxIssuedSeq),
    reason,
    nextRevisionInSequence: Boolean(wip && (wip.seq === 0 || wip.seq === maxIssuedSeq + 1)),
  };
}

/** Working-day due date for an item started today, using project overrides and the firm calendar. */
export async function dueFromToday(projectId: string, key: 'internal_review' | 'rfi_response' | 'submittal_approval' | 'conflict_reply' | 'client_review', today: string): Promise<string> {
  const [overrides, calendar] = await Promise.all([slaOverridesFor(projectId), workingCalendar()]);
  return addWorkingDays(today, slaDays(key, overrides), calendar);
}

export async function dueAtFromToday(projectId: string, key: 'conflict_reply', today: string): Promise<string> {
  const [overrides, calendar] = await Promise.all([slaOverridesFor(projectId), workingCalendar()]);
  return endOfIstDay(addWorkingDays(today, slaDays(key, overrides), calendar));
}
