/**
 * Inbound WhatsApp commands (WA-08 to WA-10). Fixed list, no AI.
 * Anything not recognised returns the help list.
 */

export const COMMANDS = ['today', 'overdue', 'critical', 'digest', 'help', 'stop', 'start'] as const;
export type Command = (typeof COMMANDS)[number];

export const HELP_TEXT = 'Commands: today, overdue, critical, digest, STOP, START';

export function parseCommand(text: string): Command {
  const normalised = text.trim().toLowerCase();
  return (COMMANDS as readonly string[]).includes(normalised) ? (normalised as Command) : 'help';
}

export const STOP_REPLY = 'You will no longer receive updates. Send START to resume.';
export const START_REPLY_CONFIRMED = 'Updates resumed.';
export const START_REPLY_NOT_CONFIRMED =
  'Your updates cannot be resumed until the admin confirms your opt-in.';
