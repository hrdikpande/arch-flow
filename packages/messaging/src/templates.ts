/**
 * WhatsApp message copy for each event (FEATURES.md, Appendix A).
 * Variables come from the event payload only. No client text is ever included
 * (CFL-07, decision 10). No files are sent (WA-16).
 */

import type { EventRow } from './ports';

export interface RenderedMessage {
  text: string;
}

const str = (v: unknown, fallback = '(unknown)'): string =>
  typeof v === 'string' && v.trim() !== '' ? v : fallback;

export function renderEvent(event: EventRow, appUrl: string): RenderedMessage | null {
  const p = event.payload;
  const link = (path: string): string => `${appUrl.replace(/\/$/, '')}${path}`;
  switch (event.type) {
    case 'file.uploaded':
      return {
        text: `Upload: ${str(p.fileName)} by ${str(p.userName)}, ${str(p.time)} IST. ${link(str(p.path, '/'))}`,
      };
    case 'revision.issued':
      return {
        text: `Issued: ${str(p.sheet)} ${str(p.rev)} (${str(p.title, 'untitled')}), ${str(p.projectCode)}, by ${str(p.userName)}, ${str(p.time)} IST. ${p.previousRev ? `Superseded: ${str(p.previousRev)}. ` : ''}${link(str(p.path, '/'))}`,
      };
    case 'approval.requested':
      return {
        text: `Approval needed: ${str(p.sheet)} ${str(p.rev)} ${str(p.transition)}, assigned to ${str(p.assignee)}, due ${str(p.due)}. ${link('/approvals')}`,
      };
    case 'approval.approved':
    case 'approval.rejected': {
      const decision = event.type === 'approval.approved' ? 'Approved' : 'Rejected';
      const reason = typeof p.reason === 'string' && p.reason ? ` Reason: ${p.reason}` : '';
      return {
        text: `${decision}: ${str(p.sheet)} ${str(p.rev)} by ${str(p.userName)}.${reason} ${link(str(p.path, '/'))}`,
      };
    }
    case 'approval.escalated':
      return {
        text: `Overdue approval: ${str(p.sheet)} ${str(p.rev)}, pending ${str(p.days)} working days with ${str(p.assignee)}. ${link('/approvals')}`,
      };
    case 'conflict.raised':
      // Notice only: project, time and link. No subject, no content (CFL-07).
      return {
        text: `New conflict on ${str(p.projectCode)} from ${str(p.clientUser)}, ${str(p.time)} IST. Open: ${link(str(p.path, '/conflicts'))}`,
      };
    case 'conflict.overdue':
      return {
        text: `Conflict overdue: ${str(p.projectCode)}, raised ${str(p.raisedOn)} by ${str(p.clientUser)}. ${link(str(p.path, '/conflicts'))}`,
      };
    case 'conflict.responded':
      return {
        text: `Conflict answered: ${str(p.projectCode)} by ${str(p.userName)}. ${link(str(p.path, '/conflicts'))}`,
      };
    case 'transmittal.sent':
      return {
        text: `Transmittal ${str(p.number)} sent for ${str(p.projectCode)} (${str(p.revisionCount, '0')} revisions). ${link(str(p.path, '/transmittals'))}`,
      };
    case 'clash.opened':
      return {
        text: `Critical clash ${str(p.number)} on ${str(p.projectCode)}: ${str(p.title)}. ${link(str(p.path, '/issues'))}`,
      };
    case 'rfi.overdue':
      return {
        text: `RFI ${str(p.number)} overdue (${str(p.days)} working days). ${str(p.projectCode)}. ${link(str(p.path, '/issues'))}`,
      };
    case 'sheet.stale_revision':
      return {
        text: `Stale revision flag: ${str(p.sheet)} ${str(p.rev)} file changed without a new revision. ${link(str(p.path, '/'))}`,
      };
    default:
      return null;
  }
}

/** Event types that count as "decisions" for immediate alerts (decision 1, WA-02). */
export const DECISION_EVENT_TYPES = [
  'approval.approved',
  'approval.rejected',
  'conflict.responded',
  'transmittal.sent',
  'revision.issued',
] as const;

/** Event types that trigger an immediate alert when the admin has switched them on. */
export const ALERT_EVENT_TYPES = [
  'file.uploaded',
  'approval.requested',
  'approval.escalated',
  'conflict.raised',
  'conflict.overdue',
  'clash.opened',
  'rfi.overdue',
  'sheet.stale_revision',
  ...DECISION_EVENT_TYPES,
] as const;
