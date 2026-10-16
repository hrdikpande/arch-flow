/**
 * Owner-defined rules (RUL-01 to RUL-06). A rule is a list of conditions on
 * one record. Rules are data, so the owner can edit them in the admin panel.
 * Draft definitions come from SCOPE.md, section 9.4 (for the owner to edit).
 */

export type RuleOperator = 'eq' | 'in' | 'contains' | 'includes' | 'gt' | 'lte';

export interface RuleCondition {
  field: string;
  op: RuleOperator;
  value: string | number | boolean | readonly string[];
}

export interface RuleDefinition {
  /** 'all' = every condition must match, 'any' = at least one. */
  match: 'all' | 'any';
  conditions: readonly RuleCondition[];
}

/** Fields a rule may refer to, per record kind. */
export const RULE_FIELDS = {
  clash: ['priority', 'disciplines', 'title', 'status'],
  rfi: ['priority', 'title', 'status', 'daysOverdue', 'daysToDue'],
  revision: ['revisionSeq', 'supersedesIssued', 'status'],
} as const;

export type RuleRecordKind = keyof typeof RULE_FIELDS;

const OPERATORS: readonly RuleOperator[] = ['eq', 'in', 'contains', 'includes', 'gt', 'lte'];

export function validateRuleDefinition(kind: RuleRecordKind, definition: RuleDefinition): string[] {
  const problems: string[] = [];
  if (definition.match !== 'all' && definition.match !== 'any') problems.push('match must be "all" or "any"');
  if (definition.conditions.length === 0) problems.push('A rule needs at least one condition');
  const allowedFields: readonly string[] = RULE_FIELDS[kind];
  for (const [index, condition] of definition.conditions.entries()) {
    if (!allowedFields.includes(condition.field)) {
      problems.push(`Condition ${index + 1}: unknown field "${condition.field}" for ${kind}`);
    }
    if (!OPERATORS.includes(condition.op)) {
      problems.push(`Condition ${index + 1}: unknown operator "${condition.op}"`);
    }
  }
  return problems;
}

export type RuleRecord = Record<string, string | number | boolean | readonly string[] | undefined>;

function matchesCondition(record: RuleRecord, condition: RuleCondition): boolean {
  const actual = record[condition.field];
  if (actual === undefined) return false;
  switch (condition.op) {
    case 'eq':
      return actual === condition.value;
    case 'in':
      return Array.isArray(condition.value) && (condition.value as readonly unknown[]).includes(actual);
    case 'contains':
      return typeof actual === 'string' && typeof condition.value === 'string'
        ? actual.toLowerCase().includes(condition.value.toLowerCase())
        : false;
    case 'includes':
      return Array.isArray(actual) && actual.includes(condition.value as string);
    case 'gt':
      return typeof actual === 'number' && typeof condition.value === 'number' && actual > condition.value;
    case 'lte':
      return typeof actual === 'number' && typeof condition.value === 'number' && actual <= condition.value;
    default:
      return false;
  }
}

export function evaluateRule(definition: RuleDefinition, record: RuleRecord): boolean {
  const results = definition.conditions.map((c) => matchesCondition(record, c));
  return definition.match === 'all' ? results.every(Boolean) : results.some(Boolean);
}

export interface NamedRule {
  id: string;
  label: string;
  kind: RuleRecordKind;
  definition: RuleDefinition;
}

/**
 * Draft critical rules for the owner to edit (decision 5, SCOPE.md section 9.4).
 * "Life-safety" is interpreted as fire, medical gas and OT pressurisation.
 * The owner must confirm these before they are used for alerts.
 */
export const DRAFT_CRITICAL_RULES: readonly NamedRule[] = [
  {
    id: 'draft-critical-clash-structure',
    label: 'Clash involves structure',
    kind: 'clash',
    definition: { match: 'all', conditions: [{ field: 'disciplines', op: 'includes', value: 'STR' }] },
  },
  {
    id: 'draft-critical-clash-life-safety',
    label: 'Clash involves fire or medical gas',
    kind: 'clash',
    definition: {
      match: 'any',
      conditions: [
        { field: 'disciplines', op: 'includes', value: 'FIR' },
        { field: 'disciplines', op: 'includes', value: 'MGS' },
      ],
    },
  },
  {
    id: 'draft-critical-clash-ot-pressure',
    label: 'Clash title mentions OT pressurisation',
    kind: 'clash',
    definition: { match: 'all', conditions: [{ field: 'title', op: 'contains', value: 'pressur' }] },
  },
  {
    id: 'draft-critical-rfi-stops-work',
    label: 'RFI is marked critical priority (stops work on site)',
    kind: 'rfi',
    definition: { match: 'all', conditions: [{ field: 'priority', op: 'eq', value: 'critical' }] },
  },
  {
    id: 'draft-critical-rfi-due-soon',
    label: 'RFI response due within 2 working days',
    kind: 'rfi',
    definition: { match: 'all', conditions: [{ field: 'daysToDue', op: 'lte', value: 2 }] },
  },
  {
    id: 'draft-critical-rfi-overdue',
    label: 'RFI more than 7 working days past its deadline',
    kind: 'rfi',
    definition: { match: 'all', conditions: [{ field: 'daysOverdue', op: 'gt', value: 7 }] },
  },
];

/**
 * Whether a clash is critical under a set of rules. Only rules of kind 'clash' apply.
 * Rule versions are recorded on each event, so this function does not decide history (RUL-06).
 */
export function isCriticalClash(record: RuleRecord, rules: readonly NamedRule[]): boolean {
  return rules
    .filter((r) => r.kind === 'clash')
    .some((r) => evaluateRule(r.definition, record));
}
