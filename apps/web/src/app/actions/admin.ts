'use server';

import { revalidatePath } from 'next/cache';
import { DRAFT_CRITICAL_RULES, validatePattern, validateRuleDefinition, type RuleDefinition, type RuleRecordKind } from '@arch-flow/domain';
import { adminDb } from '@/lib/supabase/admin';
import { assertAdmin, requireInternal } from '@/lib/access';
import { writeAudit } from '@/lib/audit';
import { ALERT_EVENT_TYPES_LIST } from '@/lib/alert-events';
import { errorState, type FormState } from './types';

const ROLE_CODES = ['admin', 'project_head', 'discipline_lead', 'drafter', 'checker', 'client'] as const;

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? '').trim();
}

/** Creates a project (PRJ-01). Admin only. */
export async function createProject(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    assertAdmin(access);
    const code = text(form, 'code').toUpperCase();
    const name = text(form, 'name');
    if (!/^[A-Z0-9][A-Z0-9-]{1,30}$/.test(code)) throw new Error('Project code: capitals, digits and hyphens, for example NRH-BLR-01.');
    if (!name) throw new Error('Project name is required.');
    const clientOrgId = text(form, 'clientOrgId') || null;
    const { data, error } = await adminDb()
      .from('projects')
      .insert({ code, name, client_org_id: clientOrgId, created_by: access.userId })
      .select('id')
      .single();
    if (error) throw new Error(error.message.includes('duplicate key') ? `Project ${code} already exists.` : error.message);
    await writeAudit({ actorId: access.userId, action: 'project.created', entityType: 'project', entityId: data.id, projectId: data.id, after: { code, name } });
    revalidatePath('/projects');
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Project created.' };
}

/** Invites a user by email. They set a password through the emailed link (AUTH-01, decision 21, 42). */
export async function inviteUser(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    assertAdmin(access);
    const email = text(form, 'email').toLowerCase();
    const fullName = text(form, 'fullName');
    const role = text(form, 'role') as (typeof ROLE_CODES)[number];
    const projectCode = text(form, 'projectCode').toUpperCase();
    const clientOrgId = text(form, 'clientOrgId') || null;
    if (!email.includes('@') || !fullName) throw new Error('Name and email are required.');
    if (!ROLE_CODES.includes(role)) throw new Error('Choose a role.');
    if (role === 'client' && !clientOrgId) throw new Error('A client user needs a client organisation.');
    const db = adminDb();
    let projectId: string | null = null;
    if (role !== 'admin') {
      const { data: project } = await db.from('projects').select('id').eq('code', projectCode).maybeSingle();
      if (!project) throw new Error(`Project ${projectCode} not found.`);
      projectId = project.id;
    }
    const redirectTo = `${process.env.APP_URL?.replace(/\/$/, '')}/auth/callback?next=/auth/setup`;
    const { data: invited, error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (error || !invited.user) throw new Error(error?.message ?? 'Could not send the invitation.');
    const { error: profileError } = await db.from('profiles').insert({ id: invited.user.id, full_name: fullName, email, client_org_id: role === 'client' ? clientOrgId : null, created_by: access.userId });
    if (profileError) throw new Error(profileError.message);
    const { error: roleError } = await db.from('user_roles').insert({ user_id: invited.user.id, role, project_id: projectId });
    if (roleError) throw new Error(roleError.message);
    await writeAudit({ actorId: access.userId, action: 'user.invited', entityType: 'profile', entityId: invited.user.id, projectId, after: { email, role } });
    revalidatePath('/admin/users');
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Invitation sent.' };
}

/** Firm defaults and project SLA overrides (SET-01, SET-02, SET-05 to SET-08). */
export async function saveSettings(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    assertAdmin(access);
    const db = adminDb();
    const numeric: [string, string][] = [
      ['sla.internal_review_days', 'internal_review'],
      ['sla.client_review_days', 'client_review'],
      ['sla.rfi_response_days', 'rfi_response'],
      ['sla.submittal_approval_days', 'submittal_approval'],
      ['sla.conflict_reply_days', 'conflict_reply'],
      ['approval.escalation_days', 'escalation'],
      ['whatsapp.daily_cap', 'cap'],
    ];
    for (const [key, field] of numeric) {
      const value = Number(text(form, field));
      if (!Number.isInteger(value) || value < 1 || value > 200) throw new Error(`${key}: enter a whole number from 1 to 200.`);
      const { error } = await db.from('settings').upsert({ project_id: null, key, value }, { onConflict: 'project_id,key' });
      if (error) throw new Error(error.message);
    }
    const time = text(form, 'digestTime');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Digest time must look like 09:00.');
    await db.from('settings').upsert({ project_id: null, key: 'digest.time_local', value: time }, { onConflict: 'project_id,key' });

    const weekend = text(form, 'weekend').split(',').map((s) => s.trim()).filter(Boolean).map(Number);
    if (weekend.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) throw new Error('Weekend days: use 0 (Sunday) to 6 (Saturday), comma separated.');
    await db.from('settings').upsert({ project_id: null, key: 'calendar.weekend_days', value: weekend }, { onConflict: 'project_id,key' });

    const filePattern = text(form, 'filePattern');
    validatePattern(filePattern, ['PROJECT', 'DISCIPLINE', 'SHEET', 'REV']);
    const transmittalPattern = text(form, 'transmittalPattern');
    validatePattern(transmittalPattern, ['PROJECT', 'YYYYMM', 'NNN']);
    await db.from('settings').upsert({ project_id: null, key: 'naming.file_pattern', value: filePattern }, { onConflict: 'project_id,key' });
    await db.from('settings').upsert({ project_id: null, key: 'naming.transmittal_pattern', value: transmittalPattern }, { onConflict: 'project_id,key' });

    await writeAudit({ actorId: access.userId, action: 'settings.saved', entityType: 'settings', after: { digestTime: time, weekend } });
    revalidatePath('/admin');
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Settings saved.' };
}

export async function addHoliday(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    assertAdmin(access);
    const day = text(form, 'day');
    const name = text(form, 'name');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !name) throw new Error('Holiday needs a date (YYYY-MM-DD) and a name.');
    const { error } = await adminDb().from('holidays').insert({ day, name });
    if (error) throw new Error(error.message.includes('duplicate key') ? 'That date is already a holiday.' : error.message);
    await writeAudit({ actorId: access.userId, action: 'holiday.added', entityType: 'holiday', after: { day, name } });
    revalidatePath('/admin');
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Holiday added.' };
}

export async function removeHoliday(form: FormData): Promise<void> {
  const access = await requireInternal();
  assertAdmin(access);
  const day = text(form, 'day');
  await adminDb().from('holidays').delete().eq('day', day);
  await writeAudit({ actorId: access.userId, action: 'holiday.removed', entityType: 'holiday', after: { day } });
  revalidatePath('/admin');
}

/** Adds a WhatsApp recipient by profile email. Opt-in is confirmed separately (WA-03). */
export async function addRecipient(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    assertAdmin(access);
    const email = text(form, 'email').toLowerCase();
    const phone = text(form, 'phone').replace(/\s+/g, '');
    if (!/^\+\d{8,15}$/.test(phone)) throw new Error('Phone must be in international format, for example +919876543210.');
    const db = adminDb();
    const { data: profile } = await db.from('profiles').select('id, client_org_id').eq('email', email).maybeSingle();
    if (!profile) throw new Error('No user with that email.');
    if (profile.client_org_id) throw new Error('Client users cannot be WhatsApp recipients (WA-15).');
    const { count } = await db.from('whatsapp_recipients').select('id', { count: 'exact', head: true }).eq('active', true);
    if ((count ?? 0) >= 5) throw new Error('The pilot group is limited to 5 people: the owner and up to 4 internal people.');
    const { error } = await db.from('whatsapp_recipients').insert({ profile_id: profile.id, phone_e164: phone, opted_in: false, active: true });
    if (error) throw new Error(error.message.includes('duplicate key') ? 'That phone number is already in the group.' : error.message);
    await writeAudit({ actorId: access.userId, action: 'whatsapp.recipient_added', entityType: 'profile', entityId: profile.id, after: { phone } });
    revalidatePath('/admin/whatsapp');
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Recipient added. Confirm their opt-in before messages are sent.' };
}

/** Records the written opt-in confirmation (WA-03). */
export async function confirmOptIn(form: FormData): Promise<void> {
  const access = await requireInternal();
  assertAdmin(access);
  const id = text(form, 'id');
  await adminDb().from('whatsapp_recipients').update({ opted_in: true, opt_in_confirmed_at: new Date().toISOString(), opted_out_at: null }).eq('id', id);
  await writeAudit({ actorId: access.userId, action: 'whatsapp.opt_in_confirmed', entityType: 'whatsapp_recipient', entityId: id });
  revalidatePath('/admin/whatsapp');
}

export async function setEventEnabled(form: FormData): Promise<void> {
  const access = await requireInternal();
  assertAdmin(access);
  const eventType = text(form, 'eventType');
  if (!ALERT_EVENT_TYPES_LIST.includes(eventType)) throw new Error('Unknown event type.');
  const enabled = form.get('enabled') === 'on';
  await adminDb().from('whatsapp_event_settings').upsert({ event_type: eventType, enabled, updated_by: access.userId, updated_at: new Date().toISOString() });
  await writeAudit({ actorId: access.userId, action: 'whatsapp.event_toggled', after: { eventType, enabled } });
  revalidatePath('/admin/whatsapp');
}

/** Stores the draft critical rules for the owner to edit (RUL-01). Does nothing if rules already exist. */
export async function loadDraftRules(): Promise<void> {
  const access = await requireInternal();
  assertAdmin(access);
  const db = adminDb();
  const { count } = await db.from('rules').select('id', { count: 'exact', head: true });
  if ((count ?? 0) > 0) return;
  const rows = DRAFT_CRITICAL_RULES.map((r) => ({ kind: r.kind, name: r.label, definition: r.definition, active: true, created_by: access.userId }));
  const { error } = await db.from('rules').insert(rows);
  if (error) throw new Error(error.message);
  await writeAudit({ actorId: access.userId, action: 'rules.drafts_loaded', after: { count: rows.length } });
  revalidatePath('/admin/rules');
}

/** Saves a rule with a new version (RUL-03, RUL-04). The previous version is kept (RUL-05). */
export async function saveRule(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    assertAdmin(access);
    const id = text(form, 'id');
    const name = text(form, 'name');
    const active = form.get('active') === 'on';
    let definition: RuleDefinition;
    try {
      definition = JSON.parse(text(form, 'definition')) as RuleDefinition;
    } catch {
      throw new Error('The rule definition is not valid JSON.');
    }
    const db = adminDb();
    const { data: rule } = await db.from('rules').select('id, kind, version, definition').eq('id', id).maybeSingle();
    if (!rule) throw new Error('Rule not found.');
    const problems = validateRuleDefinition(rule.kind as RuleRecordKind, definition);
    if (problems.length > 0) throw new Error(problems.join(' '));
    await db.from('rule_versions').insert({ rule_id: rule.id, version: rule.version, definition: rule.definition, changed_by: access.userId });
    const { error } = await db.from('rules').update({ name, definition, active, version: rule.version + 1 }).eq('id', rule.id);
    if (error) throw new Error(error.message);
    await writeAudit({ actorId: access.userId, action: 'rule.saved', entityType: 'rule', entityId: rule.id, after: { version: rule.version + 1, active } });
    revalidatePath('/admin/rules');
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Rule saved as a new version. New events use it; past events keep the version they were checked against.' };
}

/** Adds a client organisation (used for project links and client logins). */
export async function createClientOrg(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    assertAdmin(access);
    const name = text(form, 'name');
    if (!name) throw new Error('Client organisation name is required.');
    const nda = form.get('ndaRequired') === 'on';
    const { error } = await adminDb().from('client_orgs').insert({ name, nda_required: nda, allow_aps_processing: form.get('allowAps') === 'on', allow_native_download: form.get('allowNative') === 'on' });
    if (error) throw new Error(error.message);
    await writeAudit({ actorId: access.userId, action: 'client_org.created', entityType: 'client_org', after: { name, nda } });
    revalidatePath('/admin/users');
    revalidatePath('/projects');
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Client organisation added.' };
}
