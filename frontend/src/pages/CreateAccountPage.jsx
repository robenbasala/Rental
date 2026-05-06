import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { notifyCustomerSessionChanged } from "../adminSession";
import { api } from "../api";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { clearSignupPrefill, readSignupPrefill } from "../checkoutSignupPrefill";

function validEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
}

function validateSignupFields({ name, email, phone }) {
  const errs = [];
  if (!String(name).trim()) errs.push("Full name is required.");
  const em = String(email).trim();
  const ph = String(phone).trim();
  if (!em && !ph) errs.push("Enter an email or a phone number.");
  if (em && !validEmail(em)) errs.push("Enter a valid email.");
  return errs;
}

export default function CreateAccountPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fromCheckout = params.get("from") === "checkout";

  const stored = useMemo(() => (fromCheckout ? readSignupPrefill() : null), [fromCheckout]);

  const [name, setName] = useState(() => (stored?.contactName != null ? String(stored.contactName) : ""));
  const [email, setEmail] = useState(() => (stored?.contactEmail != null ? String(stored.contactEmail) : ""));
  const [phone, setPhone] = useState(() => (stored?.contactPhone != null ? String(stored.contactPhone) : ""));
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const locked = fromCheckout && !!stored;
  const returnTo = String(stored?.returnTo || "/cart").trim() || "/cart";

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    const nm = String(name).trim();
    const em = String(email).trim();
    const ph = String(phone).trim();

    const fieldErrs = validateSignupFields({ name: nm, email: em, phone: ph });
    if (fieldErrs.length) {
      setErr(fieldErrs.join(" "));
      return;
    }
    if (!password || password.length < 4) {
      setErr("Password must be at least 4 characters.");
      return;
    }
    if (password !== password2) {
      setErr("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const reg = await api.post("/auth/register", {
        name: nm,
        email: em || null,
        phone: ph || null,
        password
      });
      localStorage.setItem("customerToken", reg.data.token);
      notifyCustomerSessionChanged();
      if (fromCheckout) {
        navigate(returnTo);
      } else {
        clearSignupPrefill();
        navigate("/account");
      }
    } catch (e2) {
      const status = e2.response?.status;
      const msg = e2.response?.data?.message || e2.response?.data?.errors?.[0]?.msg;
      if (status === 409 || String(msg || "").toLowerCase().includes("already")) {
        try {
          const login = em ? em : ph;
          const log = await api.post("/auth/login", { login, password });
          localStorage.setItem("customerToken", log.data.token);
          notifyCustomerSessionChanged();
          if (fromCheckout) {
            navigate(returnTo);
          } else {
            clearSignupPrefill();
            navigate("/account");
          }
        } catch {
          setErr("That email or phone is already registered. Sign in with the correct password.");
        }
      } else {
        setErr(msg || e2.message || "Could not create account.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async (credential) => {
    setErr("");
    setLoading(true);
    try {
      const res = await api.post("/auth/google", { idToken: credential });
      localStorage.setItem("customerToken", res.data.token);
      notifyCustomerSessionChanged();
      if (fromCheckout) {
        navigate(returnTo);
      } else {
        clearSignupPrefill();
        navigate("/account");
      }
    } catch (e2) {
      setErr(e2.response?.data?.message || "Google sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  if (fromCheckout && !stored) {
    return (
      <div className="mx-auto max-w-md">
        <div className="card border-amber-200/60 p-8">
          <h1 className="text-xl font-bold text-amber-900">Continue from checkout</h1>
          <p className="mt-2 text-sm text-amber-900/85">
            We could not load your checkout details. Fill in checkout again, then choose payment — we will send you here to set your password.
          </p>
          <Link to="/checkout" className="btn-gradient mt-6 inline-block w-full text-center">
            Back to checkout
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="brand-panel">
        <div className="relative">
          <h1 className="text-2xl font-bold tracking-tight">{locked ? "Finish your account" : "Create account"}</h1>
          <p className="mt-2 text-sm text-indigo-100">
            {locked
              ? "You already entered your details at checkout. Choose a password (or use your existing one) — then you can continue from your cart."
              : "Sign up with your name and email or phone."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            <input
              className="input-glass disabled:opacity-80"
              placeholder="Full name"
              value={name}
              disabled={locked}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="input-glass disabled:opacity-80"
              placeholder="Email"
              value={email}
              disabled={locked}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="input-glass disabled:opacity-80"
              placeholder="Phone"
              value={phone}
              disabled={locked}
              onChange={(e) => setPhone(e.target.value)}
            />
            {locked && stored?.deliveryMethod && (
              <p className="text-xs text-indigo-100">
                Delivery: {stored.deliveryMethod}
                {stored.deliveryMethod === "Dropoff" && stored.deliveryAddress
                  ? ` — ${stored.deliveryAddress}`
                  : ""}
              </p>
            )}
            <input
              type="password"
              className="input-glass"
              placeholder="Password (min 4 characters)"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <input
              type="password"
              className="input-glass"
              placeholder="Confirm password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
            />
            {err && <p className="text-sm text-amber-200">{err}</p>}
            <button type="submit" disabled={loading} className="btn-primary-on-brand w-full py-2.5 disabled:opacity-60">
              {loading ? "Please wait…" : locked ? "Create account & continue" : "Create account"}
            </button>
          </form>
          {!locked && (
            <div className="mt-4">
              <GoogleSignInButton
                onCredential={handleGoogleSignIn}
                onError={(msg) => setErr(msg || "Google sign in failed.")}
              />
            </div>
          )}

          <p className="mt-6 text-center text-sm text-indigo-100">
            Already have an account?{" "}
            <Link to="/account" className="font-semibold text-white underline underline-offset-2">
              Sign in
            </Link>
          </p>
          {!fromCheckout && (
            <p className="mt-2 text-center text-xs text-indigo-200">
              <Link to="/checkout" className="underline underline-offset-2 hover:text-white">
                Checkout
              </Link>{" "}
              instead
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
