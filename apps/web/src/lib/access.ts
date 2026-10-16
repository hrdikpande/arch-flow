/**
 * Authentication and authorisation for every page and action.
 * Roles come from user_roles. Admin is firm-wide. Other roles are per project.
 * Clients see only their linked projects and issued drawings.
 */

import { redirect } from 'next/navigation';
import type { Role } from '@arch-flow/domain';
import { adminDb } from './supabase/admin';
import { userSupabase } from './supabase/server';

export interface Access {
  userId: string;
  email: string;
  name: string;
  isAdmin: boolean;
  isClient: boolean;
  clientOrgId: string | null;
  /** Roles per project id (client and internal roles). */
  projectRoles: ReadonlyMap<string, ReadonlySet<Role>>;
}

export async function currentAccess(): Promise<Access | null> {
  const supabase = await userSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const db = adminDb();
  const [{ data: profile }, { data: roles }] = await Promise.all([
    db.from('profiles').select('id, full_name, email, client_org_id, is_active').eq('id', data.user.id).maybeSingle(),
    db.from('user_roles').select('role, project_id').eq('user_id', data.user.id),
  ]);
  if (!profile || !profile.is_active) return null;

  const projectRoles = new Map<string, Set<Role>>();
  let isAdmin = false;
  for (const row of roles ?? []) {
    if (row.role === 'admin' && row.project_id === null) {
      isAdmin = true;
      continue;
    }
    if (!row.project_id) continue;
    const set = projectRoles.get(row.project_id) ?? new Set<Role>();
    set.add(row.role as Role);
    projectRoles.set(row.project_id, set);
  }
  // A client has only client roles, on their linked projects. Anyone with an internal role is internal.
  const holdsInternalRole = [...projectRoles.values()].some((set) => [...set].some((r) => r !== 'client'));
  const isClient = !isAdmin && !holdsInternalRole && [...projectRoles.values()].some((set) => set.has('client'));

  return {
    userId: profile.id,
    email: profile.email,
    name: profile.full_name,
    isAdmin,
    isClient,
    clientOrgId: profile.client_org_id ?? null,
    projectRoles,
  };
}

export async function requireAccess(): Promise<Access> {
  const access = await currentAccess();
  if (!access) redirect('/login');
  return access;
}

/** Internal user (any non-client role or admin). Clients are sent to the portal. */
export async function requireInternal(): Promise<Access> {
  const access = await requireAccess();
  if (access.isClient) redirect('/portal');
  return access;
}

export async function requireClient(): Promise<Access> {
  const access = await requireAccess();
  if (!access.isClient) redirect('/dashboard');
  return access;
}

export function hasProjectRole(access: Access, projectId: string, allowed: readonly Role[]): boolean {
  if (access.isAdmin) return true;
  const roles = access.projectRoles.get(projectId);
  return roles ? allowed.some((r) => roles.has(r)) : false;
}

export function canSee(access: Access, projectId: string): boolean {
  return access.isAdmin || access.projectRoles.has(projectId);
}

/** Throws if the user may not perform the action on this project. */
export function assertProjectRole(access: Access, projectId: string, allowed: readonly Role[]): void {
  if (!hasProjectRole(access, projectId, allowed)) {
    throw new Error("Your role doesn't allow this action on this project.");
  }
}

export function assertAdmin(access: Access): void {
  if (!access.isAdmin) throw new Error('Only the admin can do this.');
}

export async function projectByCode(code: string): Promise<{ id: string; code: string; name: string; client_org_id: string | null } | null> {
  const { data } = await adminDb().from('projects').select('id, code, name, client_org_id').eq('code', code).maybeSingle();
  return data;
}
