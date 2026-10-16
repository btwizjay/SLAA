export const STAFF_ROLES = [
  "owner",
  "admin",
  "supervisor",
  "verifier",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  admin: "Administrator",
  supervisor: "Verification supervisor",
  verifier: "Student verifier",
};
export type StaffPermission =
  | "manage_register"
  | "manage_staff"
  | "verify_applicants"
  | "manage_verification";
export function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value);
}
export function hasPermission(role: StaffRole, permission: StaffPermission) {
  if (!isStaffRole(role)) return false;
  if (permission === "manage_staff") return role === "owner";
  if (permission === "manage_register")
    return role === "owner" || role === "admin";
  if (permission === "manage_verification") return role !== "verifier";
  return permission === "verify_applicants";
}
export function staffHome(role: StaffRole) {
  return hasPermission(role, "manage_register")
    ? "/admin/overview"
    : "/admin/verification";
}
