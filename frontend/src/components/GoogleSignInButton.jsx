import { useEffect, useRef, useState } from "react";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export default function GoogleSignInButton({ onCredential, onError }) {
  const wrapRef = useRef(null);
  const [googleReady, setGoogleReady] = useState(!!window.google?.accounts?.id);

  useEffect(() => {
    if (googleReady) return;
    const id = window.setInterval(() => {
      if (window.google?.accounts?.id) {
        setGoogleReady(true);
        window.clearInterval(id);
      }
    }, 250);
    const stop = window.setTimeout(() => window.clearInterval(id), 10000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
  }, [googleReady]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleReady || !wrapRef.current) return;
    const googleApi = window.google?.accounts?.id;
    if (!googleApi) return;

    googleApi.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => {
        if (!response?.credential) {
          onError?.("Google sign-in failed.");
          return;
        }
        onCredential?.(response.credential);
      }
    });

    wrapRef.current.innerHTML = "";
    googleApi.renderButton(wrapRef.current, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      width: 300
    });
  }, [googleReady, onCredential, onError]);

  if (!GOOGLE_CLIENT_ID) {
    return <p className="text-center text-xs text-indigo-100/85">Google Sign-In needs VITE_GOOGLE_CLIENT_ID in frontend .env</p>;
  }

  if (!googleReady) {
    return <p className="text-center text-xs text-indigo-100/85">Loading Google Sign-In...</p>;
  }

  return (
    <div className="google-auth-shell">
      <p className="google-auth-label">Quick sign-in</p>
      <div ref={wrapRef} className="google-auth-target" />
    </div>
  );
}
