import { describe, expect, it } from 'vitest';
import { HELP_TEXT, parseCommand } from '../src/commands';

describe('inbound commands (WA-10)', () => {
  it('recognises the fixed commands regardless of case and spaces', () => {
    expect(parseCommand('  Today ')).toBe('today');
    expect(parseCommand('OVERDUE')).toBe('overdue');
    expect(parseCommand('stop')).toBe('stop');
  });

  it('returns help for anything unrecognised', () => {
    expect(parseCommand('what is the status of M-101?')).toBe('help');
    expect(HELP_TEXT).toBe('Commands: today, overdue, critical, digest, STOP, START');
  });
});
