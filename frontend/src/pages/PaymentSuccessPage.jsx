import { useSearchParams } from "react-router-dom";

export default function PaymentSuccessPage() {
  const [params] = useSearchParams();
  const payLater = params.get("pay_later") === "1";
  const orderNo = params.get("order");

  if (payLater) {
    return (
      <section className="card mx-auto max-w-lg p-6 text-center">
        <h1 className="text-2xl font-bold text-amber-700">Order placed — pay later</h1>
        <p className="mt-2 text-slate-600">
          Your booking is reserved. Payment is still due; we will follow up with payment options.
        </p>
        {orderNo && <p className="mt-3 text-sm font-mono text-slate-800">Order: {orderNo}</p>}
      </section>
    );
  }

  return (
    <section className="card mx-auto max-w-lg p-6 text-center">
      <h1 className="text-3xl font-bold text-green-600">Payment Successful</h1>
      <p className="mt-2 text-slate-600">Your booking is confirmed. A receipt has been emailed.</p>
    </section>
  );
}
