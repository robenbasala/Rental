import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import BookingBar from "../components/BookingBar";
import EquipmentGrid from "../components/EquipmentGrid";

function formatPackagePrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const hasCents = Math.round(n * 100) % 100 !== 0;
  return hasCents ? `$${n.toFixed(2)}` : `$${Math.round(n)}`;
}

export default function HomePage({ cart, setCart, booking, setBooking }) {
  const [packageError, setPackageError] = useState("");
  const [packageNotice, setPackageNotice] = useState("");
  const { data: packages = [], isLoading: packagesLoading } = useQuery({
    queryKey: ["packages"],
    queryFn: async () => (await api.get("/packages")).data
  });

  const faqs = [
    { q: "Is setup and takedown included?", a: "Yes. Our team handles setup and takedown for inflatable rentals." },
    { q: "Do you offer delivery?", a: "Yes. Pickup is free, dropoff pricing is calculated by distance." },
    { q: "How do I confirm my booking?", a: "Select date/time, add items, checkout, then pay securely with Stripe." },
    { q: "What areas do you serve?", a: "Lakewood, Toms River, Jackson, and Howell." }
  ];

  useEffect(() => {
    if (!packageNotice) return undefined;
    const timer = setTimeout(() => setPackageNotice(""), 2200);
    return () => clearTimeout(timer);
  }, [packageNotice]);

  const addPackageToCart = (pkg) => {
    if (!booking.rentalDate || !booking.startTime || !booking.endTime) {
      setPackageError("Please choose rental date and times first.");
      return;
    }
    const packageId = Number(pkg.Id);
    const existing = cart.find((c) => Number(c.packageId) === packageId);
    if (existing) {
      setCart(cart.map((c) => (Number(c.packageId) === packageId ? { ...c, quantity: Number(c.quantity || 1) + 1 } : c)));
    } else {
      setCart([...cart, { packageId, name: pkg.Name, unitPrice: Number(pkg.Price), quantity: 1 }]);
    }
    setPackageError("");
    setPackageNotice(`${pkg.Name} added to cart.`);
  };

  return (
    <div>
      <section className="brand-panel mb-6 !z-30 !overflow-visible !p-6">
        <p className="text-sm uppercase tracking-wide text-indigo-100">Fun. Fast. Reliable.</p>
        <h1 className="text-3xl md:text-5xl font-extrabold mt-2 tracking-tight">Kids Party Rentals Made Easy</h1>
        <p className="mt-3 max-w-2xl text-indigo-100">
          Book bounce houses, water slides, concessions and party extras in minutes.
          Clean equipment, easy checkout, and delivery options built for busy parents.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/products" className="btn-secondary-on-brand">
            Browse Rentals
          </Link>
        </div>
        <BookingBar
          booking={booking}
          setBooking={setBooking}
          className="booking-shell mt-5 p-3"
        />
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between gap-4">
          <h2 className="section-title">Popular Rentals</h2>
          <Link
            to="/products"
            className="text-sm font-semibold text-indigo-600 underline decoration-indigo-300 underline-offset-4 hover:text-fuchsia-600"
          >
            See all
          </Link>
        </div>
        <EquipmentGrid />
      </section>

      <section className="mb-8">
        <h2 className="section-title mb-4">Party Packages</h2>
        {packagesLoading && <p className="text-sm text-slate-500">Loading packages…</p>}
        {!packagesLoading && packages.length === 0 && (
          <p className="text-sm text-slate-500">No packages to show yet. Add them in Admin → Party packages.</p>
        )}
        {!packagesLoading && packages.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {packages.map((pkg) => (
              <article key={pkg.Id} className="card p-5">
                <h3 className="font-semibold">{pkg.Name}</h3>
                <p className="mt-2 text-2xl font-extrabold text-indigo-700">{formatPackagePrice(pkg.Price)}</p>
                {pkg.SummaryLine ? (
                  <p className="mt-2 text-sm text-slate-600">{pkg.SummaryLine}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => addPackageToCart(pkg)}
                  className="btn-gradient mt-4 inline-block w-full text-center"
                >
                  Add Package
                </button>
              </article>
            ))}
          </div>
        )}
        {packageError ? <p className="mt-3 text-sm text-red-600">{packageError}</p> : null}
        {packageNotice ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            {packageNotice}
          </p>
        ) : null}
      </section>

      <section className="mb-8">
        <article className="card p-5 lg:p-6">
          <h2 className="text-2xl font-bold text-slate-900">Frequently Asked Questions</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {faqs.map((f) => (
              <div key={f.q} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <p className="font-semibold text-slate-900">{f.q}</p>
                <p className="mt-1 text-sm text-slate-600">{f.a}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

    </div>
  );
}
