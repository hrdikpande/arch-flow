/**
 * Events and in-app notifications. The worker turns events into WhatsApp messages,
 * so every business change records an event here (ARCHITECTURE.md, 7).
 */

import { adminDb } from './supabase/admin';

export interface EventInput {
  type: string;
  projectId: string | null;
  entityType: string;
  entityId: string | null;
  actorId: string | null;
  payload: Record<string, unknown>;
}

export async function recordEvent(input: EventInput): Promise<void> {
  const { error } = await adminDb().from('events').insert({
    type: input.type,
    project_id: input.projectId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    actor_id: input.actorId,
    payload: input.payload,
  });
  if (error) throw new Error(`Event write failed: ${error.message}`);
}

/** Profiles that hold a role on the project (plus the owner), excluding the actor. */
export async function usersForProject(projectId: string, roles: readonly string[], excludeUserId?: string | null): Promise<string[]> {
  const db = adminDb();
  const [{ data: projectRows }, { data: adminRows }] = await Promise.all([
    db.from('user_roles').select('user_id').eq('project_id', projectId).in('role', roles),
    db.from('user_roles').select('user_id').eq('role', 'admin').is('project_id', null),
  ]);
  const ids = new Set([...(projectRows ?? []), ...(adminRows ?? [])].map((r) => r.user_id as string));
  if (excludeUserId) ids.delete(excludeUserId);
  return [...ids];
}

export async function notifyUsers(userIds: readonly string[], title: string, body: string, link: string, eventId: number | null = null): Promise<void> {
  if (userIds.length === 0) return;
  const { error } = await adminDb()
    .from('notifications')
    .insert(userIds.map((user_id) => ({ user_id, title, body, link, event_id: eventId })));
  if (error) throw new Error(`Notification write failed: ${error.message}`);
}
