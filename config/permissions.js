/**
 * Role and permission definitions.
 *
 * This file is the authority. `my-admin/src/constants/permissions.js` mirrors it
 * for UI gating only — the server never trusts the client's copy.
 */

export const ROLES = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  VIEWER: "Viewer",
};

export const ROLE_LIST = Object.values(ROLES);

/** Every permission the system understands. */
export const PERMISSIONS = {
  ENQUIRY_VIEW: "enquiry.view",
  ENQUIRY_UPDATE: "enquiry.update",
  ENQUIRY_DELETE: "enquiry.delete",
  ENQUIRY_EXPORT: "enquiry.export",

  PROJECT_VIEW: "project.view",
  PROJECT_CREATE: "project.create",
  PROJECT_UPDATE: "project.update",
  PROJECT_DELETE: "project.delete",

  BLOG_VIEW: "blog.view",
  BLOG_CREATE: "blog.create",
  BLOG_UPDATE: "blog.update",
  BLOG_DELETE: "blog.delete",
  BLOG_PUBLISH: "blog.publish",

  TEAM_VIEW: "team.view",
  TEAM_INVITE: "team.invite",
  TEAM_MANAGE: "team.manage",

  SETTINGS_MANAGE: "settings.manage",
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

/**
 * Role → permissions.
 *
 * Owner and Admin share the same permission set; Owner is additionally the only
 * role that can be the last one standing (see guards in teamController).
 */
export const ROLE_PERMISSIONS = {
  [ROLES.OWNER]: ALL_PERMISSIONS,

  [ROLES.ADMIN]: ALL_PERMISSIONS,

  [ROLES.MANAGER]: [
    PERMISSIONS.ENQUIRY_VIEW,
    PERMISSIONS.ENQUIRY_UPDATE,
    PERMISSIONS.ENQUIRY_EXPORT,
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_UPDATE,
    PERMISSIONS.BLOG_VIEW,
    PERMISSIONS.BLOG_CREATE,
    PERMISSIONS.BLOG_UPDATE,
    PERMISSIONS.BLOG_PUBLISH,
    PERMISSIONS.TEAM_VIEW,
  ],

  [ROLES.VIEWER]: [
    PERMISSIONS.ENQUIRY_VIEW,
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.BLOG_VIEW,
    PERMISSIONS.TEAM_VIEW,
  ],
};

/** Human-readable descriptions, surfaced on the Roles & Permissions page. */
export const ROLE_DESCRIPTIONS = {
  [ROLES.OWNER]:
    "Full control including billing, team management and transferring ownership.",
  [ROLES.ADMIN]:
    "Full access to every module and the team, but cannot remove the owner.",
  [ROLES.MANAGER]:
    "Works day to day on enquiries and projects. Can see the team but not change it.",
  [ROLES.VIEWER]: "Read-only access to enquiries, projects and the team.",
};

export const getPermissionsForRole = (role) => ROLE_PERMISSIONS[role] || [];

export const roleHasPermission = (role, permission) =>
  getPermissionsForRole(role).includes(permission);
