/**
 * Full-page redirect to Stripe wipes React state. Persist cart + booking so a
 * cancelled / failed return can restore them.
 *
 * Important: do NOT delete sessionStorage when restoring — React 18 Strict Mode
 * remounts and deletes would leave nothing for the second mount. Cleared only in
 * clearStripeCheckoutResume() after a paid receipt loads on PaymentSuccess.
 */

const CART_KEY = "rental_stripeResumeCart_v1";
const BOOKING_KEY = "rental_stripeResumeBooking_v1";

export function saveStripeCheckoutResume(cart, booking) {
  try {
    sessionStorage.setItem(CART_KEY, JSON.stringify(cart ?? []));
    sessionStorage.setItem(BOOKING_KEY, JSON.stringify(booking ?? {}));
  } catch {
    /* ignore quota */
  }
}

export function clearStripeCheckoutResume() {
  try {
    sessionStorage.removeItem(CART_KEY);
    sessionStorage.removeItem(BOOKING_KEY);
  } catch {
    /* ignore */
  }
}

/** Read saved state without removing (safe for Strict Mode double-mount). */
export function peekStripeCheckoutResume() {
  try {
    const rawC = sessionStorage.getItem(CART_KEY);
    const rawB = sessionStorage.getItem(BOOKING_KEY);
    return {
      cart: rawC ? JSON.parse(rawC) : null,
      booking: rawB ? JSON.parse(rawB) : null
    };
  } catch {
    return { cart: null, booking: null };
  }
}
