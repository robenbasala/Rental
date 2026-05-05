/** Dispatched after admin login (same tab); `storage` handles other tabs. */
export const ADMIN_SESSION_EVENT = "admin-session-changed";

/** Dispatched after customer login / logout (same tab). */
export const CUSTOMER_SESSION_EVENT = "customer-session-changed";

export function notifyAdminSessionChanged() {
  window.dispatchEvent(new Event(ADMIN_SESSION_EVENT));
}

export function notifyCustomerSessionChanged() {
  window.dispatchEvent(new Event(CUSTOMER_SESSION_EVENT));
}

export function parseJwtPayload(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** True if localStorage holds a non-expired admin JWT from our API. */
export function isAdminSessionToken(token) {
  const p = parseJwtPayload(token);
  if (!p || p.role !== "admin") return false;
  const id = p.userId ?? p.adminId;
  if (id == null || !Number.isFinite(Number(id))) return false;
  if (p.exp != null && typeof p.exp === "number" && p.exp * 1000 < Date.now()) return false;
  return true;
}

function tokenExpired(p) {
  return p.exp != null && typeof p.exp === "number" && p.exp * 1000 < Date.now();
}

/** True if localStorage holds a non-expired customer JWT. */
export function isCustomerSessionToken(token) {
  const p = parseJwtPayload(token);
  if (!p || p.role !== "customer") return false;
  if (p.userId == null || !Number.isFinite(Number(p.userId))) return false;
  if (tokenExpired(p)) return false;
  return true;
}

export function jwtPayloadIsAdmin(p) {
  return !!(p && (p.isAdmin === true || p.isAdmin === 1));
}

/**
 * Main nav: show Admin only when someone is signed in on the storefront (customer session)
 * and their account is marked admin. Orphan adminToken alone does not show the link.
 */
export function shouldShowAdminNav() {
  const ct = localStorage.getItem("customerToken");
  if (!isCustomerSessionToken(ct)) return false;
  const p = parseJwtPayload(ct);
  return jwtPayloadIsAdmin(p);
}

/** Prefer dedicated admin JWT; else customer JWT if user is admin (single sign-on from storefront). */
export function getTokenForAdminApi() {
  const at = localStorage.getItem("adminToken");
  if (isAdminSessionToken(at)) return at;
  const ct = localStorage.getItem("customerToken");
  if (!isCustomerSessionToken(ct)) return null;
  const p = parseJwtPayload(ct);
  return jwtPayloadIsAdmin(p) ? ct : null;
}

/** Can open /admin/* without visiting /admin/login again. */
export function hasAdminPanelAccess() {
  return getTokenForAdminApi() != null;
}
