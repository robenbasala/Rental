import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { hasAdminPanelAccess, notifyAdminSessionChanged } from "../../adminSession";
import { api, setAuthToken } from "../../api";

function safeAdminPostLoginPath(from) {
  if (typeof from !== "string" || !from.startsWith("/admin")) return null;
  if (from === "/admin" || from.startsWith("/admin/login")) return null;
  return from;
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (hasAdminPanelAccess()) {
      const dest = safeAdminPostLoginPath(location.state?.from) || "/admin/dashboard";
      navigate(dest, { replace: true });
    }
  }, [location.state, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/admin/login", { email: email.trim(), password });
      localStorage.setItem("adminToken", res.data.token);
      setAuthToken(res.data.token);
      notifyAdminSessionChanged();
      const dest = safeAdminPostLoginPath(location.state?.from) || "/admin/dashboard";
      navigate(dest, { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Login failed. Check API URL, CORS, and that the admin user exists in the database.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <form onSubmit={submit} className="brand-panel !p-8">
        <h1 className="text-2xl font-bold tracking-tight">Admin login</h1>
        <p className="mt-2 text-xs text-indigo-100/90">
          Demo: <span className="font-mono text-white">admin@kidsrental.local</span> /{" "}
          <span className="font-mono text-white">Admin123!</span> (after seed)
        </p>
        <input
          className="input-glass mt-4"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input-glass mt-3"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="mt-3 text-sm text-amber-200">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary-on-brand mt-4 w-full py-2.5 disabled:opacity-60">
          {loading ? "Signing in…" : "Login"}
        </button>
      </form>
    </div>
  );
}
