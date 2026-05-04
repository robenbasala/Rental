import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, setAuthToken } from "../../api";
import AdminNav from "../../components/AdminNav";

export default function AdminOrdersPage() {
  useEffect(() => {
    setAuthToken(localStorage.getItem("adminToken"));
  }, []);
  const { data = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => (await api.get("/admin/orders")).data
  });

  return (
    <div>
      <AdminNav />
      <section className="card p-5">
      <h1 className="card-title">Orders</h1>
      <div className="mt-4 space-y-2">
        {data.map((order) => (
          <div key={order.Id} className="border-b pb-2 flex justify-between">
            <span>{order.OrderNumber} • {order.OrderStatus}</span>
            <span>${Number(order.Total).toFixed(2)}</span>
          </div>
        ))}
      </div>
      </section>
    </div>
  );
}
