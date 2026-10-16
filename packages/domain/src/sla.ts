/**
 * Service levels and deadlines, in working days (decisions 6c, 14, 26; SET-01).
 * All calculations use the firm calendar passed in, so the weekend pattern and
 * holidays can be changed without code changes (open item O-A1).
 */

import { addWorkingDays, CalendarOptions, endOfIstDay, workingDaysBetween } from './dates';

export const SLA_DEFAULTS = {
  internal_review: 3,
  client_review: 5,
  rfi_response: 7,
  submittal_approval: 10,
  conflict_reply: 3,
  approval_escalation: 2,
} as const;

export type SlaKey = keyof typeof SLA_DEFAULTS;

export type SlaOverrides = Partial<Record<SlaKey, number>>;

export function slaDays(key: SlaKey, overrides: SlaOverrides = {}): number {
  return overrides[key] ?? SLA_DEFAULTS[key];
}

/** Due date (IST calendar date) for an item started on `startDate`. */
export function dueDateFor(startDate: string, days: number, calendar: CalendarOptions = {}): string {
  return addWorkingDays(startDate, days, calendar);
}

/** End of the IST day on which a conflict is due for a reply (CFL-03). */
export function conflictDueAt(raisedOnDate: string, overrides: SlaOverrides = {}, calendar: CalendarOptions = {}): string {
  return endOfIstDay(addWorkingDays(raisedOnDate, slaDays('conflict_reply', overrides), calendar));
}

/** Working days from today until the due date. Negative once the due date has passed. */
export function workingDaysToDue(dueDate: string, today: string, calendar: CalendarOptions = {}): number {
  if (today <= dueDate) return workingDaysBetween(today, dueDate, calendar);
  return -workingDaysBetween(dueDate, today, calendar);
}

/** Working days past the due date. Zero when not yet overdue. */
export function workingDaysOverdue(dueDate: string, today: string, calendar: CalendarOptions = {}): number {
  if (today <= dueDate) return 0;
  return workingDaysBetween(dueDate, today, calendar);
}

/** Approval escalation (APR-05): pending for at least `escalationDays` working days. */
export function isEscalationDue(
  requestedOnDate: string,
  today: string,
  escalationDays: number,
  calendar: CalendarOptions = {},
): boolean {
  return workingDaysBetween(requestedOnDate, today, calendar) >= escalationDays;
}
