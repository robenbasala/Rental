import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function AdminProtectedLayout() {
  const location = useLocation();
  const token = localStorage.getItem("adminToken");
  if (!token) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: `${location.pathname}${location.search || ""}` }}
      />
    );
  }
  return <Outlet />;
}
