import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, setAuthToken } from "../../api";
import AdminNav from "../../components/AdminNav";

function slugify(name) {
  const s = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "product";
}

const emptyForm = {
  id: null,
  name: "",
  slug: "",
  categoryId: "",
  description: "",
  pricePerRental: "",
  totalQuantity: "1",
  imageUrl: "",
  isActive: true,
  isFeatured: false
};

export default function AdminEquipmentPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    setAuthToken(localStorage.getItem("adminToken"));
  }, []);

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => (await api.get("/admin/categories")).data
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-equipment"],
    queryFn: async () => (await api.get("/admin/equipment")).data
  });

  const saveMutation = useMutation({
    mutationFn: async ({ payload, isEdit }) => {
      if (isEdit) {
        return api.put(`/admin/equipment/${payload.id}`, payload.body);
      }
      return api.post("/admin/equipment", payload.body);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-equipment"] });
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      setForm(emptyForm);
      setMessage({ type: "ok", text: variables.isEdit ? "Product updated." : "Product added." });
    },
    onError: (err) => {
      setMessage({
        type: "err",
        text: err.response?.data?.message || err.message || "Save failed"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/equipment/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-equipment"] });
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      setMessage({ type: "ok", text: "Deleted." });
    },
    onError: (err) => {
      setMessage({ type: "err", text: err.response?.data?.message || err.message || "Delete failed" });
    }
  });

  const slugPreview = useMemo(() => {
    if (form.slug.trim()) return form.slug.trim();
    return slugify(form.name);
  }, [form.name, form.slug]);

  const submit = (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });
    const slug = slugPreview;
    const payload = {
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      name: form.name.trim(),
      slug,
      description: form.description.trim() || null,
      pricePerRental: Number(form.pricePerRental),
      totalQuantity: Number(form.totalQuantity),
      isActive: !!form.isActive,
      isFeatured: !!form.isFeatured,
      imageUrl: form.imageUrl.trim() || undefined
    };
    if (!payload.name) {
      setMessage({ type: "err", text: "Name is required." });
      return;
    }
    if (Number.isNaN(payload.pricePerRental) || payload.pricePerRental < 0) {
      setMessage({ type: "err", text: "Valid price is required." });
      return;
    }
    if (Number.isNaN(payload.totalQuantity) || payload.totalQuantity < 0) {
      setMessage({ type: "err", text: "Valid quantity is required." });
      return;
    }
    if (form.id) {
      payload.imageUrl = form.imageUrl.trim();
      saveMutation.mutate({ isEdit: true, payload: { id: form.id, body: payload } });
    } else {
      saveMutation.mutate({ isEdit: false, payload: { body: payload } });
    }
  };

  const editItem = (row) => {
    setMessage({ type: "", text: "" });
    setForm({
      id: row.Id,
      name: row.Name || "",
      slug: row.Slug || "",
      categoryId: row.CategoryId != null ? String(row.CategoryId) : "",
      description: row.Description || "",
      pricePerRental: String(row.PricePerRental ?? ""),
      totalQuantity: String(row.TotalQuantity ?? "0"),
      imageUrl: row.PrimaryImageUrl || "",
      isActive: !!row.IsActive,
      isFeatured: !!row.IsFeatured
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setForm(emptyForm);
    setMessage({ type: "", text: "" });
  };

  return (
    <div>
      <AdminNav />

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card p-6">
          <h1 className="card-title">{form.id ? "Edit product" : "Add product"}</h1>
          <p className="text-sm text-slate-500 mt-1">Name, price, stock (quantity), optional image URL.</p>

          {message.text && (
            <p className={`mt-3 text-sm rounded-xl px-3 py-2 ${message.type === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
              {message.text}
            </p>
          )}

          <form onSubmit={submit} className="mt-4 space-y-3">
            <input
              className="border rounded-xl px-3 py-2 w-full"
              placeholder="Product name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              className="border rounded-xl px-3 py-2 w-full font-mono text-sm"
              placeholder="Slug (optional — auto from name)"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
            <p className="text-xs text-slate-400">Saved slug: {slugPreview}</p>

            <select
              className="border rounded-xl px-3 py-2 w-full"
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
            >
              <option value="">Category (optional)</option>
              {categories.map((c) => (
                <option key={c.Id} value={c.Id}>{c.Name}</option>
              ))}
            </select>

            <textarea
              className="border rounded-xl px-3 py-2 w-full min-h-[80px]"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />

            <div className="grid sm:grid-cols-2 gap-3">
              <input
                type="number"
                min={0}
                step="0.01"
                className="border rounded-xl px-3 py-2 w-full"
                placeholder="Price per rental ($)"
                value={form.pricePerRental}
                onChange={(e) => setForm((f) => ({ ...f, pricePerRental: e.target.value }))}
              />
              <input
                type="number"
                min={0}
                className="border rounded-xl px-3 py-2 w-full"
                placeholder="Quantity in stock"
                value={form.totalQuantity}
                onChange={(e) => setForm((f) => ({ ...f, totalQuantity: e.target.value }))}
              />
            </div>

            <input
              className="border rounded-xl px-3 py-2 w-full text-sm"
              placeholder="Image URL (https://...)"
              value={form.imageUrl}
              onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
            />

            <div className="flex gap-4 items-center">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))} />
                Featured
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="bg-indigo-600 text-white rounded-xl px-5 py-2 disabled:opacity-50"
              >
                {saveMutation.isPending ? "Saving…" : form.id ? "Update" : "Add product"}
              </button>
              {form.id && (
                <button type="button" onClick={cancelEdit} className="border rounded-xl px-5 py-2">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="card p-6">
          <h2 className="text-xl font-bold">All products</h2>
          {isLoading && <p className="mt-4 text-slate-500">Loading…</p>}
          <ul className="mt-4 divide-y divide-slate-100">
            {items.map((row) => (
              <li key={row.Id} className="py-3 flex gap-3 items-start">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white">
                  <img
                    src={row.PrimaryImageUrl || "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=200&q=60"}
                    alt=""
                    className="product-media-img"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{row.Name}</p>
                  <p className="text-sm text-slate-500">
                    ${Number(row.PricePerRental).toFixed(2)} · Qty <span className="font-semibold text-slate-800">{row.TotalQuantity}</span>
                    {!row.IsActive && <span className="ml-2 text-amber-600">(inactive)</span>}
                  </p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button type="button" onClick={() => editItem(row)} className="text-sm text-indigo-600 font-medium">
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete "${row.Name}"?`)) deleteMutation.mutate(row.Id);
                    }}
                    className="text-sm text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Direct URL: <span className="font-mono text-slate-700">/admin/equipment</span> (after admin login)
      </p>
    </div>
  );
}
