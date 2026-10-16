import { describe, expect, it } from 'vitest';
import {
  DRAFT_CRITICAL_RULES,
  evaluateRule,
  isCriticalClash,
  NamedRule,
  validateRuleDefinition,
} from '../src/rules';

describe('draft critical rules (RUL-01, decision 5)', () => {
  it('marks a structure clash as critical', () => {
    expect(isCriticalClash({ priority: 'major', disciplines: ['HVAC', 'STR'], title: 'Duct vs beam' }, DRAFT_CRITICAL_RULES)).toBe(true);
  });

  it('marks fire and medical gas clashes as critical', () => {
    expect(isCriticalClash({ disciplines: ['FIR', 'PLB'], title: 'Sprinkler main' }, DRAFT_CRITICAL_RULES)).toBe(true);
    expect(isCriticalClash({ disciplines: ['MGS', 'ARC'], title: 'Oxygen line' }, DRAFT_CRITICAL_RULES)).toBe(true);
  });

  it('marks OT pressurisation clashes as critical by title', () => {
    expect(isCriticalClash({ disciplines: ['HVAC', 'ARC'], title: 'OT pressurisation duct' }, DRAFT_CRITICAL_RULES)).toBe(true);
  });

  it('does not mark an ordinary clash as critical', () => {
    expect(isCriticalClash({ disciplines: ['ELE', 'PLB'], title: 'Cable tray' }, DRAFT_CRITICAL_RULES)).toBe(false);
  });

  it('marks an RFI due within 2 working days and one more than 7 days overdue', () => {
    const rfiRules = DRAFT_CRITICAL_RULES.filter((r) => r.kind === 'rfi');
    const matches = (record: Record<string, number | string>) => rfiRules.some((r) => evaluateRule(r.definition, record));
    expect(matches({ daysToDue: 2, priority: 'minor' })).toBe(true);
    expect(matches({ daysToDue: 5, priority: 'minor', daysOverdue: 0 })).toBe(false);
    expect(matches({ daysOverdue: 8, priority: 'minor' })).toBe(true);
    expect(matches({ daysOverdue: 7, priority: 'minor' })).toBe(false);
  });
});

describe('rule validation (RUL-03)', () => {
  it('rejects a rule with no conditions and unknown fields or operators', () => {
    const problems = validateRuleDefinition('clash', {
      match: 'all',
      conditions: [{ field: 'owner', op: 'eq', value: 'x' }],
    } as never);
    expect(problems.join(' ')).toMatch(/unknown field "owner"/);
    expect(validateRuleDefinition('clash', { match: 'all', conditions: [] })).toContain(
      'A rule needs at least one condition',
    );
  });

  it('accepts the draft rules', () => {
    for (const rule of DRAFT_CRITICAL_RULES as readonly NamedRule[]) {
      expect(validateRuleDefinition(rule.kind, rule.definition)).toEqual([]);
    }
  });
});
