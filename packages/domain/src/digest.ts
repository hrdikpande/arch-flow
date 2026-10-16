/**
 * Deterministic digest text (DIG-03, DIG-08, Appendix B of FEATURES.md).
 * The digest is always built from structured data first. Gemini text, if any,
 * is added separately and only after validation (ai-validate.ts).
 */

export const DIGEST_MAX_CHARS = 1500;

export interface IssuedItem {
  project: string;
  sheet: string;
  rev: string;
}

export interface DigestInput {
  /** IST date of the digest, 'YYYY-MM-DD'. */
  date: string;
  /** "Sent late" note when the worker was down at the scheduled time (DIG-01). */
  sentLate?: boolean;
  uploads: number;
  decisions: number;
  issued: readonly IssuedItem[];
  waitingOnYou: number;
  overdueSheets: number;
  overdueRfis: number;
  overdueReviews: number;
  overdueSubmittals: number;
  dueToday: number;
  openCriticalClashes: number;
  openCriticalRfis: number;
  /** Owner-only section (CFL-04). Omit for other recipients. */
  overdueClientConflicts?: number;
  /** Items assigned to this recipient (DIG-06). */
  yourItems: readonly string[];
  dashboardUrl: string;
  /** True when messages were held by the daily cap (WA-04). */
  capReached?: boolean;
}

export interface DigestResult {
  text: string;
  truncated: boolean;
}

function render(input: DigestInput, issuedLimit: number, yourLimit: number, restNote = false): string {
  const lines: string[] = [];
  lines.push(`Morning digest, ${input.date}, 9:00 AM IST${input.sentLate ? ' (Sent late)' : ''}`);
  lines.push(
    `Since last digest: ${input.uploads} uploads, ${input.issued.length} issued revisions, ${input.decisions} decisions`,
  );
  for (const item of input.issued.slice(0, issuedLimit)) {
    lines.push(`  - ${item.project} ${item.sheet} ${item.rev} issued`);
  }
  if (input.issued.length > issuedLimit) {
    lines.push(`  - and ${input.issued.length - issuedLimit} more, see dashboard`);
  }
  if (input.waitingOnYou > 0) lines.push(`Waiting on you: ${input.waitingOnYou} approvals`);
  lines.push(
    `Overdue: ${input.overdueSheets} sheets, ${input.overdueRfis} RFIs, ${input.overdueReviews} reviews, ${input.overdueSubmittals} submittals`,
  );
  if (input.dueToday > 0) lines.push(`Due today: ${input.dueToday} items`);
  lines.push(`Open critical: ${input.openCriticalClashes} clashes, ${input.openCriticalRfis} RFIs`);
  if (input.overdueClientConflicts !== undefined) {
    lines.push(`Client conflicts overdue: ${input.overdueClientConflicts}`);
  }
  if (input.yourItems.length > 0) {
    lines.push('Your items:');
    for (const item of input.yourItems.slice(0, yourLimit)) lines.push(`  - ${item}`);
    if (input.yourItems.length > yourLimit) lines.push(`  - and ${input.yourItems.length - yourLimit} more`);
  }
  if (input.capReached) lines.push('More items not sent. See dashboard.');
  if (restNote) lines.push('See dashboard for the rest.');
  lines.push(`Dashboard: ${input.dashboardUrl}`);
  return lines.join('\n');
}

/**
 * Build the digest text. If it is longer than DIGEST_MAX_CHARS, the issued list
 * and "your items" are shortened first, then the text is cut at a line boundary
 * with a pointer to the dashboard (DIG-08).
 */
export function buildDeterministicDigest(input: DigestInput): DigestResult {
  const full = render(input, input.issued.length, input.yourItems.length);
  if (full.length <= DIGEST_MAX_CHARS) return { text: full, truncated: false };

  for (const issuedLimit of [10, 5, 2, 0]) {
    for (const yourLimit of [10, 3, 0]) {
      const candidate = render(input, issuedLimit, yourLimit, true);
      if (candidate.length <= DIGEST_MAX_CHARS) return { text: candidate, truncated: true };
    }
  }

  // Last resort: keep the first lines that fit, then the dashboard link.
  const link = `Dashboard: ${input.dashboardUrl}`;
  const budget = DIGEST_MAX_CHARS - link.length - 30;
  const kept: string[] = [];
  let used = 0;
  for (const row of full.split('\n')) {
    if (row.startsWith('Dashboard:')) continue;
    if (used + row.length + 1 > budget) break;
    kept.push(row);
    used += row.length + 1;
  }
  return { text: `${kept.join('\n')}\nSee dashboard for the rest.\n${link}`.slice(0, DIGEST_MAX_CHARS), truncated: true };
}
