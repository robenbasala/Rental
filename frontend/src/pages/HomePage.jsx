import { Link } from "react-router-dom";
import BookingBar from "../components/BookingBar";
import EquipmentGrid from "../components/EquipmentGrid";

export default function HomePage({ cart, setCart, booking, setBooking }) {
  const categories = [
    { title: "Bounce Houses", desc: "Castle, princess and sports themes for all ages." },
    { title: "Combo Units", desc: "Jump + slide + climb combos for nonstop fun." },
    { title: "Water Slides", desc: "Cool off with single and dual lane slides." },
    { title: "Concessions", desc: "Popcorn, cotton candy and snow cone machines." },
    { title: "Tables & Chairs", desc: "Simple seating packages for birthday parties." },
    { title: "Party Add-ons", desc: "Extra fun upgrades for larger events." }
  ];

  const packages = [
    { name: "Package 1", price: "$360", items: "Large bounce + concession" },
    { name: "Package 2", price: "$435", items: "Combo unit + concession" },
    { name: "Package 3", price: "$460", items: "15ft water slide + concession" },
    { name: "Package 4", price: "$600", items: "20ft water slide + concession" }
  ];

  const faqs = [
    { q: "Is setup and takedown included?", a: "Yes. Our team handles setup and takedown for inflatable rentals." },
    { q: "Do you offer delivery?", a: "Yes. Pickup is free, dropoff pricing is calculated by distance." },
    { q: "How do I confirm my booking?", a: "Select date/time, add items, checkout, then pay securely with Stripe." },
    { q: "What areas do you serve?", a: "Lakewood, Toms River, Jackson, and Howell." }
  ];

  return (
    <div>
      <section className="brand-panel mb-6">
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
          <Link to="/checkout" className="btn-primary-on-brand">
            Start Booking
          </Link>
        </div>
      </section>

      <BookingBar booking={booking} setBooking={setBooking} />

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
        <h2 className="section-title mb-4">Rental Categories</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <article key={c.title} className="card p-5">
              <h3 className="text-lg font-semibold">{c.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{c.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="section-title mb-4">Party Packages</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {packages.map((pkg) => (
            <article key={pkg.name} className="card p-5">
              <h3 className="font-semibold">{pkg.name}</h3>
              <p className="mt-2 text-2xl font-extrabold text-indigo-700">{pkg.price}</p>
              <p className="mt-2 text-sm text-slate-600">{pkg.items}</p>
              <Link to="/checkout" className="btn-gradient mt-4 inline-block w-full text-center">
                Book Package
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-2">
        <article className="card p-5">
          <h2 className="text-2xl font-bold text-slate-900">Service Area</h2>
          <p className="mt-2 text-slate-600">Main address: 25 Monroe Ave, Toms River, NJ 08755</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="rounded-xl bg-indigo-50 px-3 py-2 text-slate-800">Lakewood, NJ</li>
            <li className="rounded-xl bg-indigo-50 px-3 py-2 text-slate-800">Toms River, NJ</li>
            <li className="rounded-xl bg-indigo-50 px-3 py-2 text-slate-800">Jackson, NJ</li>
            <li className="rounded-xl bg-indigo-50 px-3 py-2 text-slate-800">Howell, NJ</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">Delivery fee is calculated automatically based on distance.</p>
        </article>

        <article className="card p-5">
          <h2 className="text-2xl font-bold text-slate-900">Frequently Asked Questions</h2>
          <div className="mt-3 space-y-3">
            {faqs.map((f) => (
              <div key={f.q} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <p className="font-semibold text-slate-900">{f.q}</p>
                <p className="mt-1 text-sm text-slate-600">{f.a}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="brand-panel mb-2 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight">Ready to book your party?</h2>
        <p className="mt-2 text-indigo-100">Fast checkout. Easy scheduling. Happy kids.</p>
        <Link to="/checkout" className="btn-primary-on-brand mt-5 inline-block">
          Book Now
        </Link>
      </section>
    </div>
  );
}
