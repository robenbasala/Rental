import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!token) {
      setErr("Missing reset link. Open the link from your email.");
      return;
    }
    if (password.length < 4) {
      setErr("Password must be at least 4 characters.");
      return;
    }
    if (password !== password2) {
      setErr("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/reset-password", { token, password });
      setMsg(res.data?.message || "Password updated.");
      setTimeout(() => navigate("/account"), 1500);
    } catch (e2) {
      setErr(e2.response?.data?.message || e2.message || "Reset failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="brand-panel">
        <h1 className="text-2xl font-bold tracking-tight">Set new password</h1>
        <p className="mt-2 text-sm text-indigo-100">Choose a new password for your account.</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            type="password"
            className="input-glass"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            type="password"
            className="input-glass"
            placeholder="Confirm password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
          />
          {err && <p className="text-sm text-amber-200">{err}</p>}
          {msg && <p className="text-sm text-emerald-100">{msg}</p>}
          <button type="submit" disabled={loading} className="btn-primary-on-brand w-full py-2.5 disabled:opacity-60">
            {loading ? "Saving…" : "Update password"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-indigo-100">
          <Link to="/account" className="link-on-brand text-sm">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
