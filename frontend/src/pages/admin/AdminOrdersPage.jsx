import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTokenForAdminApi } from "../../adminSession";
import { api, setAuthToken } from "../../api";
import AdminNav from "../../components/AdminNav";

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=120&q=60";

function fmtMoney(n) {
  const x = Number(n);
  return Number.isFinite(x) ? `$${x.toFixed(2)}` : "—";
}

function fmtDate(v) {
  if (v == null || v === "") return "—";
  const s = typeof v === "string" ? v.slice(0, 10) : "";
  if (s && s.length >= 10) {
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
  try {
    return new Date(v).toLocaleDateString();
  } catch {
    return String(v);
  }
}

function fmtDateShort(v) {
  if (v == null || v === "") return "—";
  const s = typeof v === "string" ? v.slice(0, 10) : "";
  const d = s.length >= 10 ? new Date(s + "T12:00:00") : new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
}

function fmtTime(v) {
  if (v == null || v === "") return "—";
  const s = String(v);
  if (s.length >= 8 && s.includes(":")) return s.slice(0, 5);
  return s.slice(0, 5);
}

function fmtCreated(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return String(v);
  }
}

const emptyFilters = { orderNumber: "", name: "", date: "" };

export default function AdminOrdersPage() {
  useEffect(() => {
    setAuthToken(getTokenForAdminApi());
  }, []);

  const [filterDraft, setFilterDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);

  useEffect(() => {
    const t = setTimeout(() => setFilters(filterDraft), 350);
    return () => clearTimeout(t);
  }, [filterDraft]);

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-orders", filters.orderNumber, filters.name, filters.date],
    queryFn: async () => {
      const params = {};
      if (filters.orderNumber.trim()) params.orderNumber = filters.orderNumber.trim();
      if (filters.name.trim()) params.name = filters.name.trim();
      if (filters.date) params.date = filters.date;
      return (await api.get("/admin/orders", { params })).data;
    }
  });

  const clearFilters = () => {
    setFilterDraft(emptyFilters);
    setFilters(emptyFilters);
  };

  const hasActiveFilters =
    filterDraft.orderNumber.trim() !== "" || filterDraft.name.trim() !== "" || filterDraft.date !== "";

  return (
    <div>
      <AdminNav />
      <section className="card p-4 sm:p-5">
        <h1 className="card-title">Orders</h1>
        <p className="mt-1 text-xs text-slate-500 sm:text-sm">
          Filter by order #, customer name (contact or account), or rental date. Open a row for full details.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-2 sm:gap-3">
          <div className="min-w-[140px] flex-1">
            <label className="block text-xs font-medium text-slate-600">Order #</label>
            <input
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
              placeholder="e.g. ORD-"
              value={filterDraft.orderNumber}
              onChange={(e) => setFilterDraft((f) => ({ ...f, orderNumber: e.target.value }))}
            />
          </div>
          <div className="min-w-[160px] flex-[1.2]">
            <label className="block text-xs font-medium text-slate-600">Name / email / phone</label>
            <input
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
              placeholder="Contact or account"
              value={filterDraft.name}
              onChange={(e) => setFilterDraft((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="w-full min-w-[140px] sm:w-auto">
            <label className="block text-xs font-medium text-slate-600">Rental date</label>
            <input
              type="date"
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
              value={filterDraft.date}
              onChange={(e) => setFilterDraft((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear filters
            </button>
          ) : null}
        </div>

        {isLoading && <p className="mt-4 text-sm text-slate-500">Loading…</p>}

        {!isLoading && data.length === 0 && (
          <p className="mt-4 text-sm text-slate-500">
            {!filters.orderNumber && !filters.name && !filters.date
              ? "No orders yet."
              : "No orders match these filters."}
          </p>
        )}

        <div className="mt-3 space-y-1.5">
          {data.map((order) => {
            const items = Array.isArray(order.items) ? order.items : [];
            const acct = order.account;
            return (
              <details
                key={order.Id}
                className="group rounded-xl border border-slate-200/90 bg-white text-sm shadow-sm open:shadow-md"
              >
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="font-mono text-xs font-bold text-slate-900 sm:text-sm">{order.OrderNumber}</span>
                  <span className="text-xs text-slate-500">{fmtDateShort(order.RentalDate)}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-700 sm:text-sm">{order.ContactName}</span>
                  <span className="text-xs font-semibold text-indigo-700">{fmtMoney(order.Total)}</span>
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 sm:text-xs">
                    {order.OrderStatus}
                  </span>
                  <span className="text-[10px] text-slate-400 sm:text-xs">{order.PaymentStatus}</span>
                </summary>

                <div className="space-y-3 border-t border-slate-100 px-3 py-2.5 text-xs text-slate-700">
                  <p className="text-[11px] text-slate-500">Placed {fmtCreated(order.CreatedAt)}</p>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-slate-500">Rental</p>
                      <p className="mt-0.5">{fmtDate(order.RentalDate)}</p>
                      <p className="text-slate-600">
                        {fmtTime(order.StartTime)} – {fmtTime(order.EndTime)}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-slate-500">Delivery</p>
                      <p className="mt-0.5">{order.DeliveryMethod || "—"}</p>
                      {order.DeliveryAddress ? <p className="line-clamp-2 text-slate-600">{order.DeliveryAddress}</p> : null}
                      {Number(order.DeliveryDistanceMiles) > 0 ? (
                        <p className="text-slate-500">
                          {Number(order.DeliveryDistanceMiles).toFixed(1)} mi · {fmtMoney(order.DeliveryFee)}
                        </p>
                      ) : order.DeliveryMethod === "Dropoff" ? (
                        <p className="text-slate-500">Fee {fmtMoney(order.DeliveryFee)}</p>
                      ) : null}
                    </div>
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-slate-500">Contact</p>
                      <p className="mt-0.5 font-medium">{order.ContactName}</p>
                      {order.ContactEmail ? <p className="text-slate-600">{order.ContactEmail}</p> : null}
                      {order.ContactPhone ? <p className="text-slate-600">{order.ContactPhone}</p> : null}
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                    <p className="font-semibold uppercase tracking-wide text-slate-500">Account</p>
                    {acct ? (
                      <div className="mt-1">
                        <p className="font-medium">{acct.name}</p>
                        {acct.email ? <p className="text-slate-600">{acct.email}</p> : null}
                        {acct.phone ? <p className="text-slate-600">{acct.phone}</p> : null}
                        {acct.isAdmin ? <p className="mt-0.5 text-indigo-600">Admin user</p> : null}
                      </div>
                    ) : (
                      <p className="mt-1 text-slate-600">Guest checkout</p>
                    )}
                  </div>

                  {order.PayLater ? (
                    <p className="text-amber-800">
                      <span className="font-semibold">Pay later</span>
                    </p>
                  ) : null}

                  <div>
                    <p className="font-semibold uppercase tracking-wide text-slate-500">Line items</p>
                    {items.length === 0 ? (
                      <p className="mt-1 text-slate-500">No items.</p>
                    ) : (
                      <ul className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-100">
                        {items.map((it) => (
                          <li
                            key={it.id ?? `${it.equipmentId}-${it.itemName}`}
                            className="flex items-center gap-2 px-1.5 py-1"
                          >
                            <img
                              src={it.primaryImageUrl || FALLBACK_IMG}
                              alt=""
                              className="h-7 w-7 shrink-0 rounded-md object-cover ring-1 ring-slate-200/80"
                              loading="lazy"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-slate-900">{it.itemName}</p>
                              <p className="text-[11px] text-slate-500">
                                ×{it.quantity} @ {fmtMoney(it.unitPrice)}
                              </p>
                            </div>
                            <p className="shrink-0 font-semibold text-slate-800">{fmtMoney(it.totalPrice)}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 border-t border-slate-100 pt-2 text-[11px] text-slate-600">
                    <span>Subtotal {fmtMoney(order.Subtotal)}</span>
                    <span>Tax {fmtMoney(order.Tax)}</span>
                    {Number(order.Discount) > 0 ? <span>Discount −{fmtMoney(order.Discount)}</span> : null}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}
