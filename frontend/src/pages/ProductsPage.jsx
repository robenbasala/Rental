import BookingBar from "../components/BookingBar";
import EquipmentGrid from "../components/EquipmentGrid";

export default function ProductsPage({ cart, setCart, booking, setBooking }) {
  const tags = ["Bounce Houses", "Combo Units", "Water Slides", "Concessions", "Tables & Chairs"];

  return (
    <div>
      <section className="brand-panel mb-4 !p-6">
        <h1 className="text-3xl font-bold tracking-tight">Our Rentals</h1>
        <p className="mt-2 text-indigo-100">Pick equipment, choose date/time, and checkout in under 2 minutes.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white ring-1 ring-white/25">
              {tag}
            </span>
          ))}
        </div>
      </section>
      <BookingBar booking={booking} setBooking={setBooking} />
      <EquipmentGrid />
    </div>
  );
}
