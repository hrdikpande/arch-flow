import { timingSafeEqual } from 'node:crypto';

/** Constant-time comparison of a presented secret with the configured one. */
export function secretsMatch(presented: string | null, expected: string | undefined): boolean {
  if (!presented || !expected) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
