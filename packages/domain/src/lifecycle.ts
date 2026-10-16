/**
 * Drawing lifecycle: states, transitions and guards.
 * Source: docs-and-sql-ref/FEATURES.md (LIFE-01 to LIFE-09, section 4)
 * and docs-and-sql-ref/SCHEMA.md (section 4).
 */

export const SHEET_STATES = [
  'not_started',
  'assigned',
  'wip',
  'internal_check',
  'coordination',
  'approved',
  'issued',
  'client_review',
  'commented',
  'revised',
  'gfc',
  'ifc',
  'superseded',
] as const;

export type SheetState = (typeof SHEET_STATES)[number];

/** States in which a change needs project-head approval (decision 6d). */
export const LIVE_STATES: ReadonlySet<SheetState> = new Set<SheetState>(['issued', 'gfc', 'ifc']);

export const STATE_LABELS: Record<SheetState, string> = {
  not_started: 'Not started',
  assigned: 'Assigned',
  wip: 'In progress',
  internal_check: 'Internal check',
  coordination: 'Coordination',
  approved: 'Approved',
  issued: 'Issued',
  client_review: 'Client review',
  commented: 'Commented',
  revised: 'Revised',
  gfc: 'Good for construction',
  ifc: 'Issued for construction',
  superseded: 'Superseded',
};

/** Labels used in the register import template (dropdown values). */
export const IMPORT_STATUS_LABELS: Record<string, SheetState> = {
  'Not started': 'not_started',
  Assigned: 'assigned',
  WIP: 'wip',
  'Internal check': 'internal_check',
  Coordination: 'coordination',
  Approved: 'approved',
  Issued: 'issued',
  'Client review': 'client_review',
  Commented: 'commented',
  Revised: 'revised',
  GFC: 'gfc',
  IFC: 'ifc',
  Superseded: 'superseded',
};

export type Role = 'admin' | 'project_head' | 'discipline_lead' | 'drafter' | 'checker' | 'client' | 'system';

export type IssuePurpose = 'issued' | 'ifc' | 'gfc';

export interface TransitionContext {
  hasOwner: boolean;
  /** A checker exists for the sheet's discipline. */
  hasChecker: boolean;
  /** Checker sign-off has been recorded for the current revision. */
  checkerSignedOff: boolean;
  /** Numbers of open critical clashes linked to the sheet. */
  openCriticalClashes: readonly string[];
  /** A transmittal is selected for this issue. */
  transmittalSelected: boolean;
  /** A new revision exists for the sheet (after comments). */
  newRevisionCreated: boolean;
  /** Reason text, required for rejections and returns. */
  reason?: string;
  /** Purpose for issue transitions. */
  purpose?: IssuePurpose;
  /** Next revision sequence is valid for this issue. */
  nextRevisionInSequence: boolean;
}

export interface TransitionRule {
  from: SheetState;
  to: SheetState;
  name: string;
  roles: readonly Role[];
  /** Plain-language reasons for guards that failed. Returns null when satisfied. */
  guard: (ctx: TransitionContext) => string | null;
}

const noGuard = (): null => null;

const issueGuard = (ctx: TransitionContext): string | null => {
  const problems: string[] = [];
  if (!ctx.checkerSignedOff) problems.push('checker sign-off is missing');
  if (ctx.openCriticalClashes.length > 0) {
    problems.push(
      `${ctx.openCriticalClashes.length === 1 ? '1 open critical clash' : `${ctx.openCriticalClashes.length} open critical clashes`} (${ctx.openCriticalClashes.join(', ')})`,
    );
  }
  if (!ctx.transmittalSelected) problems.push('no transmittal is selected');
  if (!ctx.nextRevisionInSequence) problems.push('the revision number is not the next in sequence');
  if (problems.length === 0) return null;
  return `You can't issue this sheet yet: ${problems.join('; ')}.`;
};

export const TRANSITIONS: readonly TransitionRule[] = [
  {
    from: 'not_started',
    to: 'assigned',
    name: 'Assign',
    roles: ['admin', 'project_head', 'discipline_lead'],
    guard: (ctx) => (ctx.hasOwner ? null : 'Set an owner before assigning this sheet.'),
  },
  {
    from: 'assigned',
    to: 'wip',
    name: 'Start work',
    roles: ['admin', 'project_head', 'discipline_lead', 'drafter'],
    guard: noGuard,
  },
  {
    from: 'wip',
    to: 'internal_check',
    name: 'Send for internal check',
    roles: ['admin', 'project_head', 'discipline_lead', 'drafter'],
    guard: (ctx) => (ctx.hasChecker ? null : 'Assign a checker for this discipline before sending for check.'),
  },
  {
    from: 'internal_check',
    to: 'approved',
    name: 'Check sign-off',
    roles: ['admin', 'project_head', 'checker'],
    guard: noGuard,
  },
  {
    from: 'internal_check',
    to: 'wip',
    name: 'Return to drafter',
    roles: ['checker', 'admin', 'project_head'],
    guard: (ctx) => (ctx.reason?.trim() ? null : 'Give a reason when returning a sheet to the drafter.'),
  },
  {
    from: 'approved',
    to: 'coordination',
    name: 'Send to coordination',
    roles: ['admin', 'project_head', 'discipline_lead'],
    guard: noGuard,
  },
  {
    from: 'coordination',
    to: 'approved',
    name: 'Coordination complete',
    roles: ['admin', 'project_head', 'discipline_lead'],
    guard: (ctx) =>
      ctx.openCriticalClashes.length === 0
        ? null
        : `Resolve the open critical clash(es) first: ${ctx.openCriticalClashes.join(', ')}.`,
  },
  {
    from: 'approved',
    to: 'issued',
    name: 'Issue',
    roles: ['admin', 'project_head', 'checker'],
    guard: issueGuard,
  },
  {
    from: 'approved',
    to: 'ifc',
    name: 'Issue for construction',
    roles: ['admin', 'project_head', 'checker'],
    guard: issueGuard,
  },
  {
    from: 'approved',
    to: 'gfc',
    name: 'Issue good for construction',
    roles: ['admin', 'project_head', 'checker'],
    guard: issueGuard,
  },
  {
    from: 'issued',
    to: 'client_review',
    name: 'Client review started',
    roles: ['admin', 'project_head'],
    guard: noGuard,
  },
  {
    from: 'client_review',
    to: 'commented',
    name: 'Comments received',
    roles: ['system'],
    guard: noGuard,
  },
  {
    from: 'commented',
    to: 'revised',
    name: 'Revision in progress',
    roles: ['admin', 'project_head', 'discipline_lead', 'drafter'],
    guard: (ctx) => (ctx.newRevisionCreated ? null : 'Create a new revision before marking the sheet as revised.'),
  },
  {
    from: 'revised',
    to: 'wip',
    name: 'Continue work on revision',
    roles: ['admin', 'project_head', 'discipline_lead', 'drafter'],
    guard: noGuard,
  },
];

export type TransitionDecision =
  | { allowed: true; rule: TransitionRule }
  | { allowed: false; reasons: string[] };

/**
 * Decide whether a user with `actorRoles` may move a sheet from `from` to `to`.
 * Returns plain-language reasons when blocked (LIFE-08).
 */
export function decideTransition(
  from: SheetState,
  to: SheetState,
  actorRoles: readonly Role[],
  ctx: TransitionContext,
): TransitionDecision {
  const rule = TRANSITIONS.find((t) => t.from === from && t.to === to);
  if (!rule) {
    return { allowed: false, reasons: [`A sheet can't move from ${STATE_LABELS[from]} to ${STATE_LABELS[to]}.`] };
  }
  const allowedRole = actorRoles.some((role) => role === 'admin' || rule.roles.includes(role));
  if (!allowedRole) {
    return { allowed: false, reasons: [`Your role can't perform "${rule.name}" on this sheet.`] };
  }
  const guardReason = rule.guard(ctx);
  if (guardReason) return { allowed: false, reasons: [guardReason] };
  return { allowed: true, rule };
}

/** Transitions available from a state, filtered by role. Guards are not evaluated here. */
export function transitionsFrom(state: SheetState, actorRoles: readonly Role[]): TransitionRule[] {
  return TRANSITIONS.filter(
    (t) => t.from === state && (actorRoles.includes('admin') || t.roles.some((r) => actorRoles.includes(r))),
  );
}

export function isLive(state: SheetState): boolean {
  return LIVE_STATES.has(state);
}
