export default function BookingBar({ booking, setBooking }) {
  return (
    <section className="card mb-6 grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
      <input
        className="input-on-light"
        type="date"
        value={booking.rentalDate}
        onChange={(e) => setBooking((b) => ({ ...b, rentalDate: e.target.value }))}
      />
      <input
        className="input-on-light"
        type="time"
        value={booking.startTime}
        onChange={(e) => setBooking((b) => ({ ...b, startTime: e.target.value }))}
      />
      <input
        className="input-on-light"
        type="time"
        value={booking.endTime}
        onChange={(e) => setBooking((b) => ({ ...b, endTime: e.target.value }))}
      />
    </section>
  );
}
