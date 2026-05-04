import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, setAuthToken } from "../../api";
import AdminNav from "../../components/AdminNav";

export default function AdminDashboardPage() {
  useEffect(() => {
    setAuthToken(localStorage.getItem("adminToken"));
  }, []);

  const { data } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => (await api.get("/admin/dashboard")).data
  });

  return (
    <div>
      <AdminNav />
      <h1 className="admin-title">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="card p-4"><p className="text-sm text-slate-500">Total Orders</p><p className="text-2xl font-bold">{data?.totalOrders || 0}</p></div>
      <div className="card p-4"><p className="text-sm text-slate-500">Revenue</p><p className="text-2xl font-bold">${Number(data?.revenue || 0).toFixed(2)}</p></div>
      <div className="card p-4 sm:col-span-2 lg:col-span-2"><p className="text-sm text-slate-500">Upcoming Bookings</p><p className="text-sm mt-2">{data?.upcomingBookings?.length || 0} upcoming</p></div>
      <div className="card p-4 sm:col-span-2 lg:col-span-4"><p className="text-sm text-slate-500">Low Inventory Alerts</p><p className="text-sm mt-2">{data?.lowInventoryAlerts?.length || 0} items low</p></div>
      </div>
    </div>
  );
}
