export const SIGNUP_PREFILL_STORAGE_KEY = "rentalCustomerSignupPrefill";

export function readSignupPrefill() {
  try {
    const raw = sessionStorage.getItem(SIGNUP_PREFILL_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    return o;
  } catch {
    return null;
  }
}

export function writeSignupPrefill(data) {
  sessionStorage.setItem(SIGNUP_PREFILL_STORAGE_KEY, JSON.stringify(data));
}

export function clearSignupPrefill() {
  sessionStorage.removeItem(SIGNUP_PREFILL_STORAGE_KEY);
}
