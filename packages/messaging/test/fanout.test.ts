import { describe, expect, it } from 'vitest';
import { fanoutOnce } from '../src/jobs/fanout';
import { renderEvent } from '../src/templates';
import { FakeClock, FakeFanout, member, owner } from './fakes';

const T0 = new Date('2026-10-17T06:00:00Z');
const appUrl = 'https://arch-flow.example';

describe('event fan-out (ARCHITECTURE.md 3.7)', () => {
  it('queues one message per opted-in recipient for an enabled alert type', async () => {
    const fanout = new FakeFanout();
    fanout.recipients = [owner, member];
    fanout.events = [{ id: 1, type: 'revision.issued', projectId: 'p1', createdAt: T0, payload: { projectCode: 'NRH-BLR-01', sheet: 'M-101', rev: 'R2', title: 'Ground floor HVAC', userName: 'Asha', time: '11:30', path: '/projects/NRH-BLR-01/sheets/M-101' } }];
    const summary = await fanoutOnce({ fanout, clock: new FakeClock(T0), appUrl, enabledEventTypes: async () => new Set(['revision.issued']) });
    expect(summary.queued).toBe(2);
    expect(fanout.queued[0]?.body).toContain('Issued: M-101 R2');
  });

  it('skips event types the admin has switched off', async () => {
    const fanout = new FakeFanout();
    fanout.recipients = [owner];
    fanout.events = [{ id: 1, type: 'file.uploaded', projectId: 'p1', createdAt: T0, payload: { fileName: 'a.dwg' } }];
    const summary = await fanoutOnce({ fanout, clock: new FakeClock(T0), appUrl, enabledEventTypes: async () => new Set() });
    expect(summary.queued).toBe(0);
    expect(summary.skipped).toBe(1);
  });

  it('does not queue the same event twice (dedupe key)', async () => {
    const fanout = new FakeFanout();
    fanout.recipients = [owner];
    fanout.events = [{ id: 1, type: 'file.uploaded', projectId: 'p1', createdAt: T0, payload: { fileName: 'a.dwg' } }];
    const deps = { fanout, clock: new FakeClock(T0), appUrl, enabledEventTypes: async () => new Set(['file.uploaded']) };
    await fanoutOnce(deps);
    fanout.cursorValue = 0;
    const second = await fanoutOnce(deps);
    expect(second.queued).toBe(0);
    expect(fanout.queued).toHaveLength(1);
  });
});

describe('message copy never leaks client text (CFL-07, decision 10)', () => {
  it('conflict notice contains only project, client user, time and link', () => {
    const message = renderEvent(
      {
        id: 9,
        type: 'conflict.raised',
        projectId: 'p1',
        createdAt: T0,
        payload: {
          projectCode: 'NRH-BLR-01',
          clientUser: 'Dr. Rao',
          time: '11:40',
          path: '/conflicts/c1',
          subject: 'SECRET SUBJECT',
          content: 'SECRET CONTENT',
        },
      },
      appUrl,
    );
    expect(message?.text).toBe('New conflict on NRH-BLR-01 from Dr. Rao, 11:40 IST. Open: https://arch-flow.example/conflicts/c1');
    expect(message?.text).not.toContain('SECRET');
  });

  it('returns nothing for event types with no template', () => {
    expect(renderEvent({ id: 1, type: 'user.created', projectId: null, createdAt: T0, payload: {} }, appUrl)).toBeNull();
  });
});
