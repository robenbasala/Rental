import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function ForgotPasswordPage() {
  const [login, setLogin] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!login.trim()) {
      setErr("Enter your email or phone.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/forgot-password", { login: login.trim() });
      setMsg(res.data?.message || "Request received.");
    } catch (e2) {
      setErr(e2.response?.data?.message || e2.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="brand-panel">
        <div className="relative">
          <h1 className="text-2xl font-bold tracking-tight">Forgot password</h1>
          <p className="mt-2 text-sm text-indigo-100">
            Enter the email or phone on your account. If we find a match and an email is on file, we will send a reset link.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input className="input-glass" placeholder="Email or phone" value={login} onChange={(e) => setLogin(e.target.value)} />
            {err && <p className="text-sm text-amber-200">{err}</p>}
            {msg && <p className="text-sm text-emerald-100">{msg}</p>}
            <button type="submit" disabled={loading} className="btn-primary-on-brand w-full py-2.5 disabled:opacity-60">
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-indigo-100">
            <Link to="/account" className="link-on-brand text-sm">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
