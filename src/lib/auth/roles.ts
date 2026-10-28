import type { OrgRole } from "@/types/database";

// Role rank — higher means more power. Used for "can this role manage that role?" checks.
export const ROLE_RANK: Record<OrgRole, number> = {
  owner: 100,
  admin: 80,
  manager: 50,
  member: 10,
};

export function hasAtLeast(role: OrgRole, min: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

// Permission matrix — the source of truth for the Roles & permissions page and
// for in-code guards. Each permission is a verb; a role has it if listed.
export const PERMISSIONS = {
  "org.view": ["owner", "admin", "manager", "member"],
  "org.edit_settings": ["owner", "admin"],
  "org.delete": ["owner"],
  "members.view": ["owner", "admin", "manager", "member"],
  "members.invite": ["owner", "admin"],
  "members.change_role": ["owner", "admin"],
  "members.remove": ["owner", "admin"],
  "webinars.view": ["owner", "admin", "manager", "member"],
  "webinars.create": ["owner", "admin", "manager"],
  "webinars.edit": ["owner", "admin", "manager"],
  "webinars.delete": ["owner", "admin"],
  "registrants.view": ["owner", "admin", "manager", "member"],
  "registrants.export": ["owner", "admin", "manager"],
  "integrations.view": ["owner", "admin", "manager"],
  "integrations.manage": ["owner", "admin"],
  "plugins.view": ["owner", "admin", "manager"],
  "plugins.manage": ["owner", "admin"],
  "api_keys.manage": ["owner", "admin"],
  "audit_logs.view": ["owner", "admin"],
  "billing.manage": ["owner"],
} as const satisfies Record<string, readonly OrgRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: OrgRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly OrgRole[]).includes(role);
}
