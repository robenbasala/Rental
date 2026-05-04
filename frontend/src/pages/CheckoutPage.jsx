import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { clearSignupPrefill, readSignupPrefill, writeSignupPrefill } from "../checkoutSignupPrefill";

function validEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
}

export default function CheckoutPage({ cart, setCart, booking }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    deliveryMethod: "Pickup",
    deliveryAddress: ""
  });
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [payError, setPayError] = useState("");
  const [paymentChoice, setPaymentChoice] = useState("stripe");
  const [hasSession, setHasSession] = useState(() => !!localStorage.getItem("customerToken"));

  const {
    data: profile,
    isPending: profileLoading,
    isError: profileError
  } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await api.get("/me/profile")).data,
    enabled: hasSession,
    retry: false
  });

  useEffect(() => {
    if (hasSession) return;
    const saved = readSignupPrefill();
    if (saved && (saved.contactName != null || saved.contactEmail != null || saved.contactPhone != null)) {
      setForm((f) => ({
        ...f,
        contactName: saved.contactName != null ? String(saved.contactName) : f.contactName,
        contactEmail: saved.contactEmail != null ? String(saved.contactEmail) : f.contactEmail,
        contactPhone: saved.contactPhone != null ? String(saved.contactPhone) : f.contactPhone,
        deliveryMethod: saved.deliveryMethod || f.deliveryMethod,
        deliveryAddress: saved.deliveryAddress != null ? String(saved.deliveryAddress) : f.deliveryAddress
      }));
    }
  }, [hasSession]);

  useEffect(() => {
    const run = async () => {
      if (!cart.length) return;
      const res = await api.post("/cart/quote", {
        items: cart,
        deliveryMethod: form.deliveryMethod,
        deliveryAddress: form.deliveryAddress
      });
      setQuote(res.data);
    };
    run();
  }, [cart, form.deliveryMethod, form.deliveryAddress]);

  const validateContact = () => {
    const errs = [];
    const name = hasSession && profile ? String(profile.Name || "").trim() : String(form.contactName).trim();
    const em = hasSession && profile ? String(profile.Email || "").trim() : String(form.contactEmail).trim();
    const ph = hasSession && profile ? String(profile.Phone || "").trim() : String(form.contactPhone).trim();
    if (!name) errs.push("Full name is required.");
    if (!em && !ph) errs.push(hasSession ? "Add an email or phone in your account before checkout." : "Enter an email or a phone number.");
    if (em && !validEmail(em)) errs.push("Enter a valid email.");
    if (form.deliveryMethod === "Dropoff" && !String(form.deliveryAddress).trim()) {
      errs.push("Delivery address is required for dropoff.");
    }
    return errs;
  };

  const orderContactPayload = () => {
    if (hasSession && profile) {
      return {
        contactName: String(profile.Name || "").trim(),
        contactEmail: String(profile.Email || "").trim() || null,
        contactPhone: String(profile.Phone || "").trim() || null
      };
    }
    return {
      contactName: String(form.contactName).trim(),
      contactEmail: String(form.contactEmail).trim() || null,
      contactPhone: String(form.contactPhone).trim() || null
    };
  };

  const redirectToCreateAccount = () => {
    const errs = validateContact();
    if (errs.length) {
      setPayError(errs.join(" "));
      return;
    }
    writeSignupPrefill({
      contactName: String(form.contactName).trim(),
      contactEmail: String(form.contactEmail).trim(),
      contactPhone: String(form.contactPhone).trim(),
      deliveryMethod: form.deliveryMethod,
      deliveryAddress: String(form.deliveryAddress || "").trim(),
      returnTo: "/cart"
    });
    navigate("/create-account?from=checkout");
  };

  const ensureSignedIn = () => {
    if (localStorage.getItem("customerToken")) {
      setHasSession(true);
      return true;
    }
    redirectToCreateAccount();
    return false;
  };

  const postOrder = async (checkoutMode) => {
    const contact = orderContactPayload();
    return api.post("/orders", {
      ...contact,
      deliveryMethod: form.deliveryMethod,
      deliveryAddress: form.deliveryAddress,
      rentalDate: booking.rentalDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      items: cart,
      checkoutMode
    });
  };

  const payWithStripe = async () => {
    setPayError("");
    if (!booking.rentalDate || !booking.startTime || !booking.endTime) {
      setPayError("Choose rental date and start/end times before checkout.");
      return;
    }
    if (!ensureSignedIn()) return;
    if (hasSession && profileLoading) {
      setPayError("Loading your account…");
      return;
    }
    if (hasSession && profileError) {
      setPayError("Could not load your profile. Try signing in again from Account.");
      return;
    }
    const contactErrs = validateContact();
    if (contactErrs.length) {
      setPayError(contactErrs.join(" "));
      return;
    }

    setLoading(true);
    try {
      const orderRes = await postOrder("stripe");
      const paymentRes = await api.post("/payments/create-session", { orderId: orderRes.data.orderId });
      clearSignupPrefill();
      window.location.href = paymentRes.data.url;
    } catch (e) {
      setPayError(e.response?.data?.message || e.message || "Payment could not start.");
    } finally {
      setLoading(false);
    }
  };

  const payLater = async () => {
    setPayError("");
    if (!booking.rentalDate || !booking.startTime || !booking.endTime) {
      setPayError("Choose rental date and start/end times before checkout.");
      return;
    }
    if (!ensureSignedIn()) return;
    if (hasSession && profileLoading) {
      setPayError("Loading your account…");
      return;
    }
    if (hasSession && profileError) {
      setPayError("Could not load your profile. Try signing in again from Account.");
      return;
    }
    const contactErrs = validateContact();
    if (contactErrs.length) {
      setPayError(contactErrs.join(" "));
      return;
    }

    setLoading(true);
    try {
      const orderRes = await postOrder("pay_later");
      const data = orderRes.data;
      if (data.checkoutMode !== "pay_later") {
        setPayError("Server did not accept pay-later mode.");
        return;
      }
      clearSignupPrefill();
      setCart([]);
      navigate(
        `/payment-success?pay_later=1&order=${encodeURIComponent(data.orderNumber)}&id=${data.orderId}`
      );
    } catch (e) {
      setPayError(e.response?.data?.message || e.message || "Order could not be saved.");
    } finally {
      setLoading(false);
    }
  };

  const signOutCustomer = () => {
    localStorage.removeItem("customerToken");
    setHasSession(false);
    queryClient.removeQueries({ queryKey: ["profile"] });
  };

  const profileMissingContact =
    hasSession &&
    profile &&
    !profileLoading &&
    !String(profile.Email || "").trim() &&
    !String(profile.Phone || "").trim();

  return (
    <div>
      <h1 className="section-title mb-2">Checkout</h1>
      <p className="section-subtitle mb-4">
        {hasSession ? "Delivery → payment (contact from your account)" : "Account → contact → delivery → payment"}
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="brand-strip mb-4">
            <p className="font-semibold">Your account</p>
            <p className="mt-1 text-xs text-indigo-100/90">
              {hasSession
                ? "We use your saved name, email, and phone on this order. Update them anytime from Account."
                : "An account is required before placing an order. When you pay, we will open the account page with the contact details you enter below — you only set a password there (or sign in if you already have an account)."}
            </p>
            {hasSession ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-emerald-100">You are signed in.</span>
                  <button
                    type="button"
                    onClick={signOutCustomer}
                    className="shrink-0 text-sm text-white/90 underline underline-offset-2 hover:text-white"
                  >
                    Use a different account
                  </button>
                </div>
                {profileLoading && <p className="text-sm text-indigo-100">Loading profile…</p>}
                {profileError && <p className="text-sm text-amber-200">Could not load profile. Open Account and sign in again.</p>}
                {profile && !profileLoading && (
                  <div className="mt-2 rounded-xl bg-white/15 px-3 py-2 text-sm ring-1 ring-white/25">
                    <p className="font-medium">{profile.Name || "—"}</p>
                    {profile.Email && <p className="text-indigo-100">{profile.Email}</p>}
                    {profile.Phone && <p className="text-indigo-100">{profile.Phone}</p>}
                    {!profile.Email && !profile.Phone && (
                      <p className="text-amber-100">Add an email or phone in your account to complete checkout.</p>
                    )}
                    <Link to="/account" className="link-on-brand mt-2 inline-block text-sm">
                      Edit profile
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-indigo-50">Not signed in yet.</p>
                <div className="flex flex-wrap gap-2">
                  <Link to="/create-account" className="btn-primary-on-brand !px-3 !py-2 text-sm">
                    Create account
                  </Link>
                  <Link to="/account" className="py-2 text-sm font-semibold text-white underline underline-offset-2">
                    Sign in
                  </Link>
                </div>
              </div>
            )}
          </div>

          {!hasSession && (
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="input-on-light"
                placeholder="Full name"
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              />
              <input
                className="input-on-light"
                placeholder="Email"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              />
              <input
                className="input-on-light sm:col-span-2"
                placeholder="Phone"
                value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              />
            </div>
          )}

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700">Delivery Method</label>
            <select
              className="select-on-light mt-1"
              value={form.deliveryMethod}
              onChange={(e) => setForm({ ...form, deliveryMethod: e.target.value })}
            >
              <option>Pickup</option>
              <option>Dropoff</option>
            </select>
          </div>

          {form.deliveryMethod === "Dropoff" && (
            <input
              className="input-on-light mt-3"
              placeholder="Delivery Address"
              value={form.deliveryAddress}
              onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })}
            />
          )}

          <div className="mt-6 border-t border-slate-200 pt-4">
            <p className="font-medium text-slate-800">Payment</p>
            <div className="mt-3 space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50/80">
                <input type="radio" name="pay" checked={paymentChoice === "stripe"} onChange={() => setPaymentChoice("stripe")} className="mt-1" />
                <span>
                  <span className="font-medium">Pay now (Stripe)</span>
                  <span className="block text-xs text-slate-500">Secure card payment — booking confirmed after payment.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50/80">
                <input type="radio" name="pay" checked={paymentChoice === "pay_later"} onChange={() => setPaymentChoice("pay_later")} className="mt-1" />
                <span>
                  <span className="font-medium">Pay later</span>
                  <span className="block text-xs text-slate-500">Reserve the order now; pay on pickup or by arrangement.</span>
                </span>
              </label>
            </div>
          </div>
        </section>

        <aside className="brand-panel h-fit !p-5">
          <h2 className="font-bold">Order summary</h2>
          <p className="mt-2 text-sm text-indigo-100">Subtotal: ${quote?.subtotal?.toFixed?.(2) || "0.00"}</p>
          <p className="text-sm text-indigo-100">Delivery: ${quote?.deliveryFee?.toFixed?.(2) || "0.00"}</p>
          <p className="text-sm text-indigo-100">Tax: ${quote?.tax?.toFixed?.(2) || "0.00"}</p>
          <p className="mt-2 text-lg font-bold">Total: ${quote?.total?.toFixed?.(2) || "0.00"}</p>
          {!!quote?.distanceMiles && <p className="mt-1 text-xs text-indigo-100/80">Distance: {quote.distanceMiles} miles</p>}
          {payError && <p className="mt-3 text-sm text-amber-200">{payError}</p>}
          {paymentChoice === "stripe" ? (
            <button
              disabled={loading || !cart.length || (hasSession && (profileLoading || profileError)) || profileMissingContact}
              onClick={payWithStripe}
              className="btn-primary-on-brand mt-4 w-full py-2.5 text-sm disabled:opacity-50"
            >
              {loading ? "Processing..." : "Pay with Stripe"}
            </button>
          ) : (
            <button
              disabled={loading || !cart.length || (hasSession && (profileLoading || profileError)) || profileMissingContact}
              onClick={payLater}
              className="mt-4 w-full rounded-xl bg-amber-400 py-2.5 text-sm font-semibold text-amber-950 shadow-md transition hover:bg-amber-300 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Place order — pay later"}
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
