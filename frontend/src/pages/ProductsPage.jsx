import BookingBar from "../components/BookingBar";
import EquipmentGrid from "../components/EquipmentGrid";

export default function ProductsPage({ cart, setCart, booking, setBooking }) {
  const tags = ["Bounce Houses", "Combo Units", "Water Slides", "Concessions", "Tables & Chairs"];

  return (
    <div>
      <section className="brand-panel mb-6 !z-30 !overflow-visible !p-6">
        <h1 className="text-3xl font-bold tracking-tight">Your Simcha Time</h1>
        <p className="mt-2 text-indigo-100">Pick your date and time, then browse rentals in under 2 minutes.</p>
        <BookingBar
          booking={booking}
          setBooking={setBooking}
          className="booking-shell mt-5 p-3"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white ring-1 ring-white/25">
              {tag}
            </span>
          ))}
        </div>
      </section>
      <EquipmentGrid />
    </div>
  );
}
