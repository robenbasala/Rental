import { Link, useLocation } from "react-router-dom";

const links = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/equipment", label: "Products & stock" },
  { to: "/admin/receivables", label: "Receivables" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/settings", label: "Settings" }
];

export default function AdminNav() {
  const { pathname } = useLocation();
  return (
    <nav className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white/50 p-2 shadow-sm backdrop-blur-md">
      {links.map(({ to, label }) => (
        <Link
          key={to}
          to={to}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
            pathname === to
              ? "bg-gradient-to-r from-indigo-600 to-fuchsia-600 font-semibold text-white shadow-md"
              : "text-slate-700 hover:bg-white/90 hover:text-indigo-700"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
