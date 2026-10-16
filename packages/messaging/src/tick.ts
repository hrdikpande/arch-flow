/**
 * One scheduled pass for Vercel Cron .
 * Order matters: checks create events, fan-out turns events into messages, the outbox sends them.
 */

import { fanoutOnce, type FanoutDeps } from './jobs/fanout';
import { processOutboxOnce, type OutboxDeps } from './jobs/outbox';
import { runScheduledDigests, runEscalations, runConflictOverdue, type ScheduleDeps } from './jobs/schedule';
import { runOverdueRfiCheck, runStaleRevisionCheck, type ChecksPort } from './jobs/checks';
import type { Clock } from './ports';

export interface TickDeps {
  clock: Clock;
  fanout: FanoutDeps;
  outbox: OutboxDeps;
  schedule: ScheduleDeps;
  checks: ChecksPort;
}

export interface TickSummary {
  rfiOverdueEvents: number;
  staleRevisionEvents: number;
  queued: number;
  sent: number;
  digests: number;
  escalations: number;
  conflictNotices: number;
}

export async function runTick(deps: TickDeps): Promise<TickSummary> {
  const rfiOverdueEvents = await runOverdueRfiCheck({ checks: deps.checks, clock: deps.clock });
  const staleRevisionEvents = await runStaleRevisionCheck({ checks: deps.checks, clock: deps.clock });
  const fan = await fanoutOnce(deps.fanout);
  const digests = await runScheduledDigests(deps.schedule);
  const escalations = await runEscalations(deps.schedule);
  const conflictNotices = await runConflictOverdue(deps.schedule);
  const out = await processOutboxOnce(deps.outbox);
  return { rfiOverdueEvents, staleRevisionEvents, queued: fan.queued, sent: out.sent, digests, escalations, conflictNotices };
}
