import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import { api } from "../api";

export default function ProductDetailsPage({ cart, setCart, booking, setBooking }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    rentalDate: booking.rentalDate || "",
    startTime: booking.startTime || "",
    endTime: booking.endTime || "",
    quantity: 1
  });
  const [error, setError] = useState("");

  const { data: item } = useQuery({
    queryKey: ["equipment", id],
    queryFn: async () => (await api.get(`/equipment/${id}`)).data
  });

  const addToCart = () => {
    if (!item) return;
    if (!form.rentalDate || !form.startTime || !form.endTime) {
      setError("Please choose date, start time, and end time.");
      return;
    }
    if (Number(form.quantity) < 1) {
      setError("Quantity must be at least 1.");
      return;
    }

    setBooking({
      rentalDate: form.rentalDate,
      startTime: form.startTime,
      endTime: form.endTime
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
        <p className="text-sm text-slate-500 mt-1">Step 1: Select schedule, Step 2: Add to cart</p>
        <div className="mt-4 space-y-3">
          <input
            type="date"
            className="input-on-light"
            value={form.rentalDate}
            onChange={(e) => setForm((v) => ({ ...v, rentalDate: e.target.value }))}
          />
          <input
            type="time"
            className="input-on-light"
            value={form.startTime}
            onChange={(e) => setForm((v) => ({ ...v, startTime: e.target.value }))}
          />
          <input
            type="time"
            className="input-on-light"
            value={form.endTime}
            onChange={(e) => setForm((v) => ({ ...v, endTime: e.target.value }))}
          />
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
