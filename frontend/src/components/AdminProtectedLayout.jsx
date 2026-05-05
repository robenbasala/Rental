import { Navigate, Outlet, useLocation } from "react-router-dom";
import { hasAdminPanelAccess } from "../adminSession";

export default function AdminProtectedLayout() {
  const location = useLocation();
  if (!hasAdminPanelAccess()) {
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
