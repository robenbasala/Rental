import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, setAuthToken } from "../../api";
import AdminNav from "../../components/AdminNav";

export default function AdminReceivablesPage() {
  const queryClient = useQueryClient();
  const [payLaterOnly, setPayLaterOnly] = useState(false);
  const [refs, setRefs] = useState({});

  useEffect(() => {
    setAuthToken(localStorage.getItem("adminToken"));
  }, []);

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-receivables", payLaterOnly],
    queryFn: async () =>
      (await api.get("/admin/receivables", { params: { payLaterOnly: payLaterOnly ? "1" : "0" } })).data
  });

  const confirmMut = useMutation({
    mutationFn: ({ id, reference, note }) =>
      api.post(`/admin/orders/${id}/confirm-payment`, { reference, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-receivables"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    }
  });

  return (
    <div>
      <AdminNav />
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="card-title">Receivables</h1>
            <p className="text-sm text-slate-500 mt-1">Unpaid orders — confirm when you receive cash, check, or Zelle.</p>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={payLaterOnly} onChange={(e) => setPayLaterOnly(e.target.checked)} />
            Pay later only
          </label>
        </div>

        {isLoading && <p className="text-slate-500">Loading…</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-2 pr-2">Order</th>
                <th className="py-2 pr-2">Customer</th>
                <th className="py-2 pr-2">Rental</th>
                <th className="py-2 pr-2">Total</th>
                <th className="py-2 pr-2">Type</th>
                <th className="py-2 pr-2">Reference</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.Id} className="border-b border-slate-100">
                  <td className="py-2 pr-2 font-mono">{o.OrderNumber}</td>
                  <td className="py-2 pr-2">
                    <div>{o.ContactName}</div>
                    <div className="text-xs text-slate-500">{o.ContactEmail || o.ContactPhone}</div>
                  </td>
                  <td className="py-2 pr-2 whitespace-nowrap">{String(o.RentalDate).slice(0, 10)}</td>
                  <td className="py-2 pr-2 font-semibold">${Number(o.Total).toFixed(2)}</td>
                  <td className="py-2 pr-2">
                    {o.PayLater ? (
                      <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs">Pay later</span>
                    ) : (
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-xs">Unpaid</span>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      className="border rounded-lg px-2 py-1 w-full max-w-[140px] text-xs"
                      placeholder="Check # / ref"
                      value={refs[o.Id] ?? ""}
                      onChange={(e) => setRefs((r) => ({ ...r, [o.Id]: e.target.value }))}
                    />
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      disabled={confirmMut.isPending}
                      onClick={() =>
                        confirmMut.mutate({
                          id: o.Id,
                          reference: refs[o.Id] || undefined,
                          note: ""
                        })
                      }
                      className="bg-green-600 text-white rounded-xl px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                    >
                      Confirm payment
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isLoading && data.length === 0 && (
          <p className="text-slate-500 mt-4">No open balances.</p>
        )}

        {confirmMut.isError && (
          <p className="text-red-600 text-sm mt-3">
            {(confirmMut.error?.response?.data?.message || confirmMut.error?.message)}
          </p>
        )}
      </section>
    </div>
  );
}
