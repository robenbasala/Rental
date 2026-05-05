import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { notifyAdminSessionChanged, notifyCustomerSessionChanged } from "../adminSession";

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=400&q=70";

function formatDate(v) {
  if (!v) return "—";
  const s = String(v).slice(0, 10);
  if (!s || s === "Invalid") return "—";
  try {
    return new Date(s + "T12:00:00").toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch {
    return s;
  }
}

function formatTime(v) {
  if (v == null || v === "") return "—";
  const s = String(v);
  if (s.length >= 8 && s.includes(":")) return s.slice(0, 5);
  return s.slice(0, 5);
}

function statusClass(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("paid") || s.includes("confirm") || s.includes("complete")) return "bg-emerald-500/15 text-emerald-800 ring-emerald-500/30";
  if (s.includes("pend")) return "bg-amber-500/15 text-amber-900 ring-amber-500/30";
  if (s.includes("cancel")) return "bg-red-500/15 text-red-800 ring-red-500/30";
  if (s.includes("delivery")) return "bg-sky-500/15 text-sky-900 ring-sky-500/30";
  return "bg-slate-500/10 text-slate-700 ring-slate-500/20";
}

export default function CustomerAccountPage() {
  const queryClient = useQueryClient();
  const [session, setSession] = useState(() => localStorage.getItem("customerToken"));
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const enabled = !!session;

  const { data: profile, isError: profileError, isPending: profileLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await api.get("/me/profile")).data,
    enabled,
    retry: false
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => (await api.get("/me/orders")).data,
    enabled
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["my-invoices"],
    queryFn: async () => (await api.get("/me/invoices")).data,
    enabled
  });

  useEffect(() => {
    if (profileError && session) {
      localStorage.removeItem("customerToken");
      localStorage.removeItem("adminToken");
      notifyCustomerSessionChanged();
      notifyAdminSessionChanged();
      setSession(null);
      queryClient.removeQueries({ queryKey: ["profile"] });
      queryClient.removeQueries({ queryKey: ["my-orders"] });
      queryClient.removeQueries({ queryKey: ["my-invoices"] });
    }
  }, [profileError, session, queryClient]);

  const signOut = () => {
    localStorage.removeItem("customerToken");
    localStorage.removeItem("adminToken");
    notifyCustomerSessionChanged();
    notifyAdminSessionChanged();
    setSession(null);
    queryClient.removeQueries({ queryKey: ["profile"] });
    queryClient.removeQueries({ queryKey: ["my-orders"] });
    queryClient.removeQueries({ queryKey: ["my-invoices"] });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await api.post("/auth/login", {
        login: loginId.trim(),
        password: loginPassword
      });
      localStorage.setItem("customerToken", res.data.token);
      notifyCustomerSessionChanged();
      setSession(res.data.token);
      setLoginPassword("");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (err) {
      setLoginError(err.response?.data?.message || "Sign in failed.");
    }
  };

  if (!session) {
    return (
      <div className="mx-auto max-w-md">
        <div className="brand-panel">
          <div className="relative">
            <h1 className="text-2xl font-bold tracking-tight">Your account</h1>
            <p className="mt-2 text-sm text-indigo-100">Sign in to see orders, invoices, and saved details.</p>
            <form onSubmit={handleLogin} className="mt-6 space-y-3">
              <input
                className="input-glass"
                placeholder="Email or phone"
                autoComplete="username"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
              />
              <input
                type="password"
                className="input-glass"
                placeholder="Password"
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
              {loginError && <p className="text-sm text-amber-200">{loginError}</p>}
              <button type="submit" className="btn-primary-on-brand w-full py-2.5">
                Sign in
              </button>
              <div className="text-center">
                <Link to="/forgot-password" className="link-on-brand text-sm">
                  Forgot password?
                </Link>
              </div>
            </form>
            <p className="mt-4 text-center text-xs text-indigo-100">
              New here?{" "}
              <Link to="/create-account" className="link-on-brand text-xs">
                Create an account
              </Link>{" "}
              or{" "}
              <Link to="/checkout" className="link-on-brand text-xs">
                complete checkout
              </Link>{" "}
              — we will ask for a password when you pay.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <section className="brand-panel">
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300">Signed in</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{profile?.Name || "Member"}</h1>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-indigo-100">
              {profile?.Email && (
                <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/20">{profile.Email}</span>
              )}
              {profile?.Phone && (
                <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/20">{profile.Phone}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="shrink-0 rounded-2xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/20 transition"
          >
            Sign out
          </button>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="section-title">Orders</h2>
            <p className="section-subtitle">Full rental details and equipment photos.</p>
          </div>
        </div>
        <div className="grid gap-6">
          {orders.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
              No orders yet.
            </div>
          )}
          {orders.map((o) => (
            <article
              key={o.Id}
              className="group overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm ring-1 ring-slate-100/80 transition hover:shadow-lg"
            >
              <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-mono text-xs text-slate-400">{o.OrderNumber}</p>
                  <p className="text-lg font-semibold text-slate-900">{formatDate(o.RentalDate)}</p>
                  <p className="text-sm text-slate-500">
                    {formatTime(o.StartTime)} – {formatTime(o.EndTime)} · {o.DeliveryMethod}
                    {o.DeliveryMethod === "Dropoff" && o.DeliveryAddress && (
                      <span className="mt-1 block text-slate-400">{o.DeliveryAddress}</span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClass(o.OrderStatus)}`}>
                    {o.OrderStatus}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClass(o.PaymentStatus)}`}>
                    Payment: {o.PaymentStatus}
                  </span>
                  <span className="text-2xl font-bold text-indigo-700">${Number(o.Total).toFixed(2)}</span>
                </div>
              </div>
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Items</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(o.items || []).map((it) => (
                    <div
                      key={it.Id}
                      className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-3 transition group-hover:border-indigo-100"
                    >
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm">
                        <img
                          src={it.ImageUrl || FALLBACK_IMG}
                          alt=""
                          className="product-media-img"
                          loading="lazy"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900 line-clamp-2">{it.ItemName}</p>
                        <p className="mt-1 text-xs text-slate-500">Qty {it.Quantity}</p>
                        <p className="text-sm font-semibold text-indigo-700">${Number(it.TotalPrice).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-slate-400">Subtotal</p>
                    <p className="font-medium">${Number(o.Subtotal).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Delivery</p>
                    <p className="font-medium">${Number(o.DeliveryFee).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Tax</p>
                    <p className="font-medium">${Number(o.Tax).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Distance</p>
                    <p className="font-medium">{Number(o.DeliveryDistanceMiles || 0).toFixed(1)} mi</p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="section-title">Invoices</h2>
          <p className="section-subtitle">Paid bookings with line items and totals.</p>
        </div>
        <div className="grid gap-6">
          {invoices.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
              No invoices yet.
            </div>
          )}
          {invoices.map((inv) => (
            <article
              key={inv.Id}
              className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm ring-1 ring-violet-100/60"
            >
              <div className="flex flex-col justify-between gap-4 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-5 text-white md:flex-row md:items-center">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-violet-200">Invoice</p>
                  <p className="font-mono text-xl font-bold">{inv.InvoiceNumber}</p>
                  <p className="text-sm text-violet-100">Order {inv.OrderNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-violet-200">Total</p>
                  <p className="text-3xl font-bold">${Number(inv.Total).toFixed(2)}</p>
                  <p className="text-xs text-violet-200">{formatDate(inv.InvoiceDate || inv.CreatedAt)}</p>
                </div>
              </div>
              <div className="p-5">
                <div className="mb-4 flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-full px-2.5 py-1 font-medium ring-1 ${statusClass(inv.OrderStatus)}`}>{inv.OrderStatus}</span>
                  <span className={`rounded-full px-2.5 py-1 font-medium ring-1 ${statusClass(inv.PaymentStatus)}`}>{inv.PaymentStatus}</span>
                </div>
                <p className="text-sm text-slate-600">
                  <span className="font-medium text-slate-800">{formatDate(inv.RentalDate)}</span>
                  <span className="text-slate-400"> · </span>
                  {formatTime(inv.StartTime)} – {formatTime(inv.EndTime)}
                  <span className="text-slate-400"> · </span>
                  {inv.DeliveryMethod}
                </p>
                {(inv.DeliveryAddress || inv.ContactName) && (
                  <p className="mt-2 text-xs text-slate-500">
                    {inv.ContactName}
                    {inv.DeliveryAddress && ` · ${inv.DeliveryAddress}`}
                  </p>
                )}
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(inv.items || []).map((it) => (
                    <div key={it.Id} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white">
                        <img
                          src={it.ImageUrl || FALLBACK_IMG}
                          alt=""
                          className="product-media-img"
                          loading="lazy"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 line-clamp-2">{it.ItemName}</p>
                        <p className="text-xs text-slate-500">×{it.Quantity}</p>
                        <p className="text-sm font-semibold text-violet-700">${Number(it.TotalPrice).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-6 border-t border-slate-100 pt-4 text-sm">
                  <span>
                    <span className="text-slate-400">Subtotal </span>
                    <span className="font-semibold">${Number(inv.Subtotal).toFixed(2)}</span>
                  </span>
                  <span>
                    <span className="text-slate-400">Delivery </span>
                    <span className="font-semibold">${Number(inv.DeliveryFee).toFixed(2)}</span>
                  </span>
                  <span>
                    <span className="text-slate-400">Tax </span>
                    <span className="font-semibold">${Number(inv.Tax).toFixed(2)}</span>
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
