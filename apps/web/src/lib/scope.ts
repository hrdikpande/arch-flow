import type { Access } from './access';

/** Project ids the user can see. null = every project (admin). */
export function visibleProjectIds(access: Access): string[] | null {
  if (access.isAdmin) return null;
  return [...access.projectRoles.keys()];
}
