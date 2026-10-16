import { describe, expect, it } from 'vitest';
import { decideTransition, transitionsFrom, TransitionContext } from '../src/lifecycle';

const ok: TransitionContext = {
  hasOwner: true,
  hasChecker: true,
  checkerSignedOff: true,
  openCriticalClashes: [],
  transmittalSelected: true,
  newRevisionCreated: true,
  nextRevisionInSequence: true,
  purpose: 'issued',
};

describe('transition guards (LIFE-02 to LIFE-08)', () => {
  it('blocks assignment without an owner with the plain message', () => {
    const result = decideTransition('not_started', 'assigned', ['project_head'], { ...ok, hasOwner: false });
    expect(result).toEqual({ allowed: false, reasons: ['Set an owner before assigning this sheet.'] });
  });

  it('blocks issue with a clash list and every failing reason', () => {
    const result = decideTransition('approved', 'issued', ['project_head'], {
      ...ok,
      checkerSignedOff: false,
      openCriticalClashes: ['CL-044'],
      transmittalSelected: false,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reasons[0]).toBe(
        "You can't issue this sheet yet: checker sign-off is missing; 1 open critical clash (CL-044); no transmittal is selected.",
      );
    }
  });

  it('allows issue when every guard is satisfied', () => {
    const result = decideTransition('approved', 'issued', ['project_head'], ok);
    expect(result.allowed).toBe(true);
  });

  it('requires a reason to return a sheet to the drafter (LIFE-07)', () => {
    const blank = decideTransition('internal_check', 'wip', ['checker'], { ...ok, reason: '  ' });
    expect(blank.allowed).toBe(false);
    const given = decideTransition('internal_check', 'wip', ['checker'], { ...ok, reason: 'Duct sizes missing' });
    expect(given.allowed).toBe(true);
  });

  it('blocks coordination completion while critical clashes are open', () => {
    const result = decideTransition('coordination', 'approved', ['discipline_lead'], {
      ...ok,
      openCriticalClashes: ['CL-001', 'CL-002'],
    });
    expect(result).toEqual({
      allowed: false,
      reasons: ['Resolve the open critical clash(es) first: CL-001, CL-002.'],
    });
  });

  it('refuses a drafter the issue transition (role check)', () => {
    const result = decideTransition('approved', 'issued', ['drafter'], ok);
    expect(result).toEqual({ allowed: false, reasons: ['Your role can\'t perform "Issue" on this sheet.'] });
  });

  it('refuses transitions that are not in the state machine', () => {
    const result = decideTransition('not_started', 'issued', ['admin'], ok);
    expect(result.allowed).toBe(false);
  });

  it('lists only transitions the role may use', () => {
    const names = transitionsFrom('approved', ['drafter']).map((t) => t.name);
    expect(names).toEqual([]); // a drafter has no transitions out of Approved
    expect(transitionsFrom('approved', ['discipline_lead']).map((x) => x.name)).toEqual(['Send to coordination']);
    const adminNames = transitionsFrom('approved', ['admin']).map((t) => t.name);
    expect(adminNames).toEqual(expect.arrayContaining(['Issue', 'Issue for construction', 'Issue good for construction']));
  });
});
