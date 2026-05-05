import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTokenForAdminApi } from "../../adminSession";
import { api, setAuthToken } from "../../api";
import AdminNav from "../../components/AdminNav";

const emptyForm = {
  id: null,
  name: "",
  summaryLine: "",
  price: "",
  sortOrder: "0",
  isActive: true
};

export default function AdminPackagesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [banner, setBanner] = useState({ type: "", text: "" });

  useEffect(() => {
    setAuthToken(getTokenForAdminApi());
  }, []);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ["admin-packages"],
    queryFn: async () => (await api.get("/admin/packages")).data
  });

  const saveMutation = useMutation({
    mutationFn: async ({ isEdit, body, id }) => {
      if (isEdit) return api.put(`/admin/packages/${id}`, body);
      return api.post("/admin/packages", body);
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      setForm(emptyForm);
      setBanner({ type: "ok", text: vars.isEdit ? "Package updated." : "Package created." });
    },
    onError: (err) => {
      setBanner({
        type: "err",
        text: err.response?.data?.message || err.message || "Save failed"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/packages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      setForm(emptyForm);
      setBanner({ type: "ok", text: "Package deleted." });
    },
    onError: (err) => {
      setBanner({
        type: "err",
        text: err.response?.data?.message || err.message || "Delete failed"
      });
    }
  });

  const submit = (e) => {
    e.preventDefault();
    setBanner({ type: "", text: "" });
    const name = String(form.name || "").trim();
    const price = Number(form.price);
    if (!name) {
      setBanner({ type: "err", text: "Name is required." });
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setBanner({ type: "err", text: "Enter a valid price." });
      return;
    }
    const body = {
      name,
      summaryLine: String(form.summaryLine || "").trim() || null,
      price,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: !!form.isActive
    };
    const isEdit = form.id != null;
    saveMutation.mutate({ isEdit, body, id: form.id });
  };

  const editRow = (row) => {
    setBanner({ type: "", text: "" });
    setForm({
      id: row.Id,
      name: row.Name ?? "",
      summaryLine: row.SummaryLine ?? "",
      price: String(row.Price ?? ""),
      sortOrder: String(row.SortOrder ?? 0),
      isActive: !!row.IsActive
    });
  };

  return (
    <div>
      <AdminNav />
      <section className="card p-6 max-w-4xl">
        <h1 className="card-title">Party packages</h1>
        <p className="text-sm text-slate-500 mt-1">
          These appear on the home page. Customers still add real equipment in checkout — packages are for display and pricing reference.
        </p>

        {banner.text && (
          <p
            className={`mt-4 text-sm rounded-xl px-3 py-2 ${
              banner.type === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"
            }`}
          >
            {banner.text}
          </p>
        )}

        <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700">Name</label>
            <input
              className="mt-1 border rounded-xl px-3 py-2 w-full"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700">Summary (what&apos;s included)</label>
            <input
              className="mt-1 border rounded-xl px-3 py-2 w-full"
              value={form.summaryLine}
              onChange={(e) => setForm((f) => ({ ...f, summaryLine: e.target.value }))}
              placeholder="e.g. Large bounce + concession"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Price ($)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="mt-1 border rounded-xl px-3 py-2 w-full"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Sort order</label>
            <input
              type="number"
              step="1"
              className="mt-1 border rounded-xl px-3 py-2 w-full"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              id="pkg-active"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            <label htmlFor="pkg-active" className="text-sm text-slate-700">
              Active (shown on home page)
            </label>
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="bg-indigo-600 text-white rounded-xl px-6 py-2 font-medium disabled:opacity-50"
            >
              {form.id != null ? "Update package" : "Add package"}
            </button>
            {form.id != null && (
              <button
                type="button"
                onClick={() => setForm(emptyForm)}
                className="rounded-xl border border-slate-300 px-6 py-2 font-medium text-slate-700"
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>

        <div className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">All packages</h2>
          {isLoading && <p className="mt-2 text-slate-500">Loading…</p>}
          {!isLoading && packages.length === 0 && (
            <p className="mt-2 text-sm text-slate-500">No packages yet. Add one above.</p>
          )}
          {packages.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-2 pr-2">Order</th>
                    <th className="py-2 pr-2">Name</th>
                    <th className="py-2 pr-2">Summary</th>
                    <th className="py-2 pr-2">Price</th>
                    <th className="py-2 pr-2">Active</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {packages.map((p) => (
                    <tr key={p.Id} className="border-b border-slate-100">
                      <td className="py-2 pr-2">{p.SortOrder}</td>
                      <td className="py-2 pr-2 font-medium">{p.Name}</td>
                      <td className="py-2 pr-2 text-slate-600 max-w-xs truncate">{p.SummaryLine || "—"}</td>
                      <td className="py-2 pr-2">${Number(p.Price).toFixed(2)}</td>
                      <td className="py-2 pr-2">{p.IsActive ? "Yes" : "No"}</td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => editRow(p)}
                          className="text-indigo-600 font-medium mr-3"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete “${p.Name}”?`)) deleteMutation.mutate(p.Id);
                          }}
                          className="text-red-600 font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
