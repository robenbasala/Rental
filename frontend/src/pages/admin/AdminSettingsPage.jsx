import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTokenForAdminApi } from "../../adminSession";
import { api, setAuthToken } from "../../api";
import AdminNav from "../../components/AdminNav";

const emptyForm = {
  businessAddress: "",
  deliveryFixedFee: "",
  deliveryPricePerMile: "",
  maxDeliveryDistanceMiles: "",
  taxPercent: "",
  companyName: "",
  supportEmail: "",
  supportPhone: ""
};

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [banner, setBanner] = useState({ type: "", text: "" });

  useEffect(() => {
    setAuthToken(getTokenForAdminApi());
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await api.get("/admin/settings")).data
  });

  useEffect(() => {
    if (!data) return;
    const tax = Number(data.TaxRate ?? 0);
    setForm({
      businessAddress: data.BusinessAddress ?? "",
      deliveryFixedFee: String(data.DeliveryFixedFee ?? ""),
      deliveryPricePerMile: String(data.DeliveryPricePerMile ?? ""),
      maxDeliveryDistanceMiles: String(data.MaxDeliveryDistanceMiles ?? ""),
      taxPercent: (Number.isFinite(tax) ? tax * 100 : 0).toFixed(2),
      companyName: data.CompanyName ?? "",
      supportEmail: data.SupportEmail ?? "",
      supportPhone: data.SupportPhone ?? ""
    });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (payload) => api.put("/admin/settings", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      setBanner({ type: "ok", text: "Settings saved." });
    },
    onError: (err) => {
      setBanner({
        type: "err",
        text: err.response?.data?.message || err.message || "Save failed"
      });
    }
  });

  const submit = (e) => {
    e.preventDefault();
    setBanner({ type: "", text: "" });

    const deliveryFixedFee = Number(form.deliveryFixedFee);
    const deliveryPricePerMile = Number(form.deliveryPricePerMile);
    const maxDeliveryDistanceMiles = Number(form.maxDeliveryDistanceMiles);
    const taxPercent = Number(form.taxPercent);
    if (!String(form.businessAddress).trim()) {
      setBanner({ type: "err", text: "Business address is required." });
      return;
    }
    if (!Number.isFinite(deliveryFixedFee) || deliveryFixedFee < 0) {
      setBanner({ type: "err", text: "Dropoff base fee must be zero or a positive number." });
      return;
    }
    if (!Number.isFinite(deliveryPricePerMile) || deliveryPricePerMile < 0) {
      setBanner({ type: "err", text: "Delivery price per mile must be a valid number." });
      return;
    }
    if (!Number.isFinite(maxDeliveryDistanceMiles) || maxDeliveryDistanceMiles <= 0) {
      setBanner({ type: "err", text: "Max delivery distance must be a positive number." });
      return;
    }
    if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100) {
      setBanner({ type: "err", text: "Tax percent must be between 0 and 100." });
      return;
    }

    const taxRate = Math.round((taxPercent / 100) * 10000) / 10000;

    saveMutation.mutate({
      businessAddress: String(form.businessAddress).trim(),
      deliveryFixedFee,
      deliveryPricePerMile,
      maxDeliveryDistanceMiles,
      taxRate,
      companyName: String(form.companyName).trim() || "Kids Party Rentals",
      supportEmail: String(form.supportEmail).trim() || null,
      supportPhone: String(form.supportPhone).trim() || null
    });
  };

  return (
    <div>
      <AdminNav />
      <section className="card p-6 max-w-2xl">
        <h1 className="card-title">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Values are loaded from the database and apply to quotes, delivery, and tax.</p>

        {isLoading && <p className="mt-4 text-slate-500">Loading…</p>}

        {banner.text && (
          <p
            className={`mt-4 text-sm rounded-xl px-3 py-2 ${
              banner.type === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"
            }`}
          >
            {banner.text}
          </p>
        )}

        {!isLoading && data && (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Company name</label>
              <input
                className="mt-1 border rounded-xl px-3 py-2 w-full"
                value={form.companyName}
                onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Business address</label>
              <textarea
                className="mt-1 border rounded-xl px-3 py-2 w-full min-h-[72px]"
                value={form.businessAddress}
                onChange={(e) => setForm((f) => ({ ...f, businessAddress: e.target.value }))}
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Dropoff base fee ($)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="mt-1 border rounded-xl px-3 py-2 w-full"
                  value={form.deliveryFixedFee}
                  onChange={(e) => setForm((f) => ({ ...f, deliveryFixedFee: e.target.value }))}
                />
                <p className="text-xs text-slate-500 mt-1">Added once per dropoff, before per-mile charges.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Price per mile ($)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="mt-1 border rounded-xl px-3 py-2 w-full"
                  value={form.deliveryPricePerMile}
                  onChange={(e) => setForm((f) => ({ ...f, deliveryPricePerMile: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Max delivery distance (miles)</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  className="mt-1 border rounded-xl px-3 py-2 w-full"
                  value={form.maxDeliveryDistanceMiles}
                  onChange={(e) => setForm((f) => ({ ...f, maxDeliveryDistanceMiles: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Tax rate (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                className="mt-1 border rounded-xl px-3 py-2 w-full max-w-xs"
                value={form.taxPercent}
                onChange={(e) => setForm((f) => ({ ...f, taxPercent: e.target.value }))}
              />
              <p className="text-xs text-slate-500 mt-1">Stored as decimal in DB (e.g. 6.62% → 0.0662).</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Support email</label>
                <input
                  type="email"
                  className="mt-1 border rounded-xl px-3 py-2 w-full"
                  value={form.supportEmail}
                  onChange={(e) => setForm((f) => ({ ...f, supportEmail: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Support phone</label>
                <input
                  className="mt-1 border rounded-xl px-3 py-2 w-full"
                  value={form.supportPhone}
                  onChange={(e) => setForm((f) => ({ ...f, supportPhone: e.target.value }))}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="bg-indigo-600 text-white rounded-xl px-6 py-2 font-medium disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving…" : "Save settings"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
