export const PERMISSIONS = {
  MANAGE_JOBS: "manage_jobs",
  VIEW_PIPELINE: "view_pipeline",
  MANAGE_CANDIDATES: "manage_candidates",
  ADMIN: "admin",
};

export function hasPermission(userPermissions, permission) {
  if (!Array.isArray(userPermissions)) return false;
  return userPermissions.includes(permission) || userPermissions.includes(PERMISSIONS.ADMIN);
}
