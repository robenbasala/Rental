import { useParams } from "react-router-dom";

export default function InvoicePage() {
  const { id } = useParams();
  return (
    <section className="card p-6">
      <h1 className="text-2xl font-bold text-slate-900">Invoice #{id}</h1>
      <p className="text-slate-600 mt-2">Invoice details are available through backend invoice APIs.</p>
    </section>
  );
}
