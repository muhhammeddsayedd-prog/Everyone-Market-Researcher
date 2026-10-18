/** Member roles from app.members.role. Safe to import from client components (types and pure logic only). */
export type MemberRole = 'viewer' | 'analyst' | 'admin';

const ROLE_RANK: Record<MemberRole, number> = { viewer: 1, analyst: 2, admin: 3 };

export function roleAtLeast(role: MemberRole, minimum: MemberRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export const ROLE_LABEL: Record<MemberRole, string> = {
  viewer: 'Viewer',
  analyst: 'Analyst',
  admin: 'Admin',
};
