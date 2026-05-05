import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import { api } from "../api";

export default function ProductDetailsPage({ cart, setCart, booking, setBooking }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    quantity: 1
  });
  const [error, setError] = useState("");

  const formatTime12 = (time) => {
    if (!time) return "Not selected";
    const [h, m] = String(time).split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return time;
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  const { data: item } = useQuery({
    queryKey: ["equipment", id],
    queryFn: async () => (await api.get(`/equipment/${id}`)).data
  });

  const addToCart = () => {
    if (!item) return;
    if (!booking.rentalDate || !booking.startTime || !booking.endTime) {
      setError("Please choose date/time from the booking picker at the top first.");
      return;
    }
    if (Number(form.quantity) < 1) {
      setError("Quantity must be at least 1.");
      return;
    }

    setBooking({
      rentalDate: booking.rentalDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      durationHours: booking.durationHours || 4
    });

    const existing = cart.find((c) => c.equipmentId === item.Id);
    if (existing) {
      setCart(cart.map((c) => c.equipmentId === item.Id ? { ...c, quantity: c.quantity + Number(form.quantity) } : c));
    } else {
      setCart([...cart, { equipmentId: item.Id, name: item.Name, unitPrice: Number(item.PricePerRental), quantity: Number(form.quantity) }]);
    }
    navigate("/cart");
  };

  if (!item) return <p className="text-slate-600">Loading…</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <article className="card flex min-h-0 flex-col overflow-hidden p-0">
        <div className="product-media-hero">
          <img
            src={item.PrimaryImageUrl || "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&q=60"}
            alt={item.Name}
            className="product-media-img"
          />
        </div>
        <div className="p-5">
          <h1 className="text-2xl font-bold">{item.Name}</h1>
          <p className="mt-2 text-slate-600">{item.Description || "Perfect for birthday fun."}</p>
          <p className="mt-3 text-xl font-bold text-indigo-700">${Number(item.PricePerRental).toFixed(2)}</p>
        </div>
      </article>

      <article className="card p-5">
        <h2 className="text-xl font-bold">Choose Date & Time</h2>
        <p className="text-sm text-slate-500 mt-1">Schedule is set from the top booking picker. You can only choose quantity here.</p>
        <div className="mt-4 space-y-3">
          <div className="input-on-light bg-slate-50/90">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</p>
            <p className="mt-1 font-medium text-slate-900">{booking.rentalDate || "Not selected"}</p>
          </div>
          <div className="input-on-light bg-slate-50/90">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start Time</p>
            <p className="mt-1 font-medium text-slate-900">{formatTime12(booking.startTime)}</p>
          </div>
          <div className="input-on-light bg-slate-50/90">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">End Time</p>
            <p className="mt-1 font-medium text-slate-900">{formatTime12(booking.endTime)}</p>
          </div>
          <input
            type="number"
            min={1}
            className="input-on-light"
            value={form.quantity}
            onChange={(e) => setForm((v) => ({ ...v, quantity: Number(e.target.value || 1) }))}
          />
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button type="button" onClick={addToCart} className="btn-gradient mt-4 w-full py-2.5">
          Add to Cart
        </button>
      </article>
    </div>
  );
}
