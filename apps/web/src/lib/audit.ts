import { adminDb } from './supabase/admin';

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entityType?: string;
  entityId?: string | null;
  projectId?: string | null;
  before?: unknown;
  after?: unknown;
}

/** Append-only audit record (AUD-01 to AUD-04). Failures are reported, not hidden. */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  const { error } = await adminDb().from('audit_log').insert({
    actor_id: entry.actorId,
    action: entry.action,
    entity_type: entry.entityType ?? null,
    entity_id: entry.entityId ?? null,
    project_id: entry.projectId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
  if (error) throw new Error(`Audit write failed: ${error.message}`);
}
