import { adminDb } from './supabase/admin';

/** Firm-level setting value (project_id is null). */
export async function firmSetting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await adminDb().from('settings').select('value').is('project_id', null).eq('key', key).maybeSingle();
  return data ? (data.value as T) : fallback;
}

/** Calendar used for working days (O-A1 placeholder until confirmed). */
export async function workingCalendar(): Promise<{ holidays: Set<string>; weekendDays: number[] }> {
  const db = adminDb();
  const [{ data: holidays }, weekend] = await Promise.all([
    db.from('holidays').select('day'),
    firmSetting<number[]>('calendar.weekend_days', [0, 6]),
  ]);
  return { holidays: new Set((holidays ?? []).map((h) => h.day as string)), weekendDays: weekend };
}

export async function slaOverridesFor(projectId: string): Promise<Record<string, number>> {
  const { data } = await adminDb().from('settings').select('key, value').eq('project_id', projectId);
  const out: Record<string, number> = {};
  for (const row of data ?? []) {
    if (row.key.startsWith('sla.')) out[row.key.slice(4).replace(/_days$/, '')] = Number(row.value);
  }
  return out;
}
