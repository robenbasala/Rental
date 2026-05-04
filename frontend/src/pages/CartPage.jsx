import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=400&q=70";

function formatRentalDate(isoDate) {
  if (!isoDate) return "—";
  const s = String(isoDate).slice(0, 10);
  try {
    return new Date(s + "T12:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  } catch {
    return s;
  }
}

function formatTime12(t) {
  if (t == null || String(t).trim() === "") return "—";
  const parts = String(t).split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1] || 0);
  if (Number.isNaN(h)) return String(t).slice(0, 5);
  const d = new Date(2000, 0, 1, h, m, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function CartPage({ cart, setCart, booking }) {
  const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const subtotalLocal = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  const { data: equipment = [] } = useQuery({
    queryKey: ["equipment"],
    queryFn: async () => (await api.get("/equipment")).data,
    staleTime: 60_000
  });

  const { data: quote } = useQuery({
    queryKey: ["cart-quote", cart],
    queryFn: async () =>
      (
        await api.post("/cart/quote", {
          items: cart,
          deliveryMethod: "Pickup",
          deliveryAddress: ""
        })
      ).data,
    enabled: cart.length > 0
  });

  const imageById = Object.fromEntries(
    equipment.map((e) => [e.Id, e.PrimaryImageUrl || FALLBACK_IMG])
  );

  const updateQty = (equipmentId, delta) => {
    setCart(
      cart
        .map((c) => {
          if (c.equipmentId !== equipmentId) return c;
          const next = c.quantity + delta;
          if (next < 1) return null;
          return { ...c, quantity: next };
        })
        .filter(Boolean)
    );
  };

  const removeLine = (equipmentId) => {
    setCart(cart.filter((c) => c.equipmentId !== equipmentId));
  };

  const subtotal = quote?.subtotal ?? subtotalLocal;
  const deliveryFee = quote?.deliveryFee ?? 0;
  const tax = quote?.tax ?? 0;
  const total = quote?.total ?? subtotalLocal;

  return (
    <div className="min-h-[70vh] -mx-4 -mt-6 px-4 py-8 sm:-mx-4">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Your Cart</h1>
          <p className="mt-1 text-slate-600">Review your rental items before checkout</p>
        </header>

        {cart.length === 0 ? (
          <div className="rounded-3xl border border-slate-200/80 bg-white/60 p-12 text-center text-slate-700 shadow-lg backdrop-blur-md">
            <p className="text-lg">Your cart is empty.</p>
            <Link to="/products" className="btn-primary-on-brand mt-6 inline-block">
              Browse rentals
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
            <div className="space-y-4">
              {cart.map((item) => (
                <div
                  key={item.equipmentId}
                  className="card flex flex-col overflow-hidden transition hover:border-indigo-200/60 sm:flex-row sm:gap-0"
                >
                  <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden bg-slate-100 sm:aspect-auto sm:h-44 sm:w-44 sm:rounded-l-3xl">
                    <img
                      src={imageById[item.equipmentId] || FALLBACK_IMG}
                      alt=""
                      className="product-media-img"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-slate-900">{item.name}</h2>
                      <p className="mt-1 text-base font-medium text-slate-700">${Number(item.unitPrice).toFixed(2)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          className="rounded-l-2xl px-3 py-2 text-slate-600 hover:bg-slate-100"
                          onClick={() => updateQty(item.equipmentId, -1)}
                        >
                          −
                        </button>
                        <span className="min-w-[2rem] text-center text-sm font-semibold text-slate-900">{item.quantity}</span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          className="rounded-r-2xl px-3 py-2 text-slate-600 hover:bg-slate-100"
                          onClick={() => updateQty(item.equipmentId, 1)}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(item.equipmentId)}
                        className="text-sm font-medium text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <aside className="brand-panel lg:sticky lg:top-6 !p-6">
              <h2 className="text-lg font-bold">Order summary</h2>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/20">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-100/80">Rental date</p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                    <span className="text-indigo-100/60" aria-hidden>
                      ◷
                    </span>
                    {formatRentalDate(booking.rentalDate)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/20">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-100/80">Time slot</p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                    <span className="text-indigo-100/60" aria-hidden>
                      ◐
                    </span>
                    {formatTime12(booking.startTime)} – {formatTime12(booking.endTime)}
                  </p>
                </div>
              </div>

              <dl className="mt-6 space-y-3 border-t border-white/20 pt-5 text-sm text-indigo-100">
                <div className="flex justify-between">
                  <dt>
                    Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})
                  </dt>
                  <dd className="font-semibold text-white">${Number(subtotal).toFixed(2)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Delivery</dt>
                  <dd>
                    {Number(deliveryFee) <= 0 ? (
                      <span className="font-semibold text-emerald-200">Free</span>
                    ) : (
                      <span className="font-semibold text-white">${Number(deliveryFee).toFixed(2)}</span>
                    )}
                  </dd>
                </div>
                {quote && (
                  <div className="flex justify-between">
                    <dt>Tax</dt>
                    <dd className="font-semibold text-white">${Number(tax).toFixed(2)}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-6 flex items-end justify-between border-t border-white/20 pt-5">
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-100/80">Total</span>
                <span className="text-3xl font-bold tracking-tight">${Number(total).toFixed(2)}</span>
              </div>

              <Link
                to="/checkout"
                className="btn-primary-on-brand mt-6 flex w-full items-center justify-center gap-2 py-3.5 text-sm"
              >
                <span aria-hidden>🔒</span>
                Checkout
              </Link>
              <p className="mt-3 text-center text-xs text-indigo-100/70">Secure checkout powered by Stripe</p>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
