import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { clearStripeCheckoutResume } from "../checkoutStripeResume";

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=400&q=70";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function apiOrigin() {
  return API_BASE.replace(/\/?api\/?$/i, "").replace(/\/$/, "") || "";
}

/** Absolute URL for equipment images (handles paths stored relative to API origin). */
function resolveReceiptImageUrl(url) {
  const u = String(url ?? "").trim();
  if (!u) return FALLBACK_IMG;
  if (/^https?:\/\//i.test(u)) return u;
  const origin = apiOrigin();
  if (u.startsWith("/")) return `${origin}${u}`;
  return `${origin}/${u}`;
}

function fmtMoney(n) {
  const x = Number(n);
  return Number.isFinite(x) ? `$${x.toFixed(2)}` : "—";
}

function fmtDate(iso) {
  if (!iso) return "—";
  const s = String(iso).slice(0, 10);
  try {
    return new Date(s + "T12:00:00").toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  } catch {
    return s;
  }
}

/** SQL TIME often serializes as ISO with a 1970 date — avoid slicing that to "1970-". */
function fmtTime(v) {
  if (v == null || v === "") return "—";
  if (typeof v === "object" && v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
  }
  const s = String(v).trim();
  const isoTime = s.match(/T(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (isoTime) {
    const hh = isoTime[1].padStart(2, "0");
    const mm = isoTime[2];
    const ref = new Date(`1970-01-01T${hh}:${mm}:00`);
    return ref.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
  }
  const hm = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (hm) {
    const ref = new Date(`1970-01-01T${hm[1].padStart(2, "0")}:${hm[2]}:00`);
    return ref.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
  }
  return "—";
}

/**
 * Load every receipt image through the API proxy as a blob URL so html2canvas
 * is not tainted by cross-origin pixels (fixes blank PDF / SecurityError).
 */
async function inlineImagesForPdf(container) {
  const imgs = [...container.querySelectorAll("img[data-receipt-img]")];
  const blobUrls = [];
  for (const img of imgs) {
    const raw = img.getAttribute("data-original-url") || "";
    const resolved = resolveReceiptImageUrl(raw);
    const fetchUrl = resolved || FALLBACK_IMG;
    try {
      const proxyUrl = `${API_BASE}/media/image?url=${encodeURIComponent(fetchUrl)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error("proxy");
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      blobUrls.push(objUrl);
      img.src = objUrl;
      await new Promise((done) => {
        const finish = () => done();
        if (img.complete && img.naturalWidth > 0) finish();
        else {
          img.onload = finish;
          img.onerror = finish;
        }
      });
    } catch {
      try {
        const res = await fetch(fetchUrl, { mode: "cors" });
        if (!res.ok) throw new Error("direct");
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        blobUrls.push(objUrl);
        img.src = objUrl;
        await new Promise((done) => {
          img.onload = () => done();
          img.onerror = () => done();
        });
      } catch {
        img.src = FALLBACK_IMG;
        await new Promise((done) => {
          img.onload = done;
          img.onerror = done;
        });
      }
    }
  }
  return blobUrls;
}

/** html2canvas cannot parse `oklch()` (see styles.css :root). Override with hex on the cloned document. */
function injectHtml2canvasColorFix(doc) {
  const style = doc.createElement("style");
  style.setAttribute("data-html2canvas-color-fix", "1");
  style.textContent = `
    :root {
      --background: #ffffff;
      --foreground: #252525;
      --card: #ffffff;
      --card-foreground: #252525;
      --popover: #ffffff;
      --popover-foreground: #252525;
      --primary: #343434;
      --primary-foreground: #fafafa;
      --secondary: #f7f7f7;
      --secondary-foreground: #343434;
      --muted: #f7f7f7;
      --muted-foreground: #8e8e8e;
      --accent: #f7f7f7;
      --accent-foreground: #343434;
      --destructive: #dc2626;
      --destructive-foreground: #fafafa;
      --border: #ebebeb;
      --input: #ebebeb;
      --ring: #b5b5b5;
    }
  `;
  doc.head.appendChild(style);
}

export default function PaymentSuccessPage({ setCart }) {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const payLater = params.get("pay_later") === "1";
  const orderIdParam = params.get("id");

  const receiptRef = useRef(null);
  const [order, setOrder] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError("");
      const requestOpts = { timeout: 45000 };

      try {
        if (payLater && orderIdParam) {
          const res = await api.get(`/orders/${encodeURIComponent(orderIdParam)}`, requestOpts);
          if (cancelled) return;
          setOrder(res.data);
          clearStripeCheckoutResume();
          setCart([]);
        } else if (sessionId) {
          let lastErr = null;
          let loaded = false;
          for (let attempt = 0; attempt < 20; attempt++) {
            if (cancelled) return;
            try {
              const res = await api.post("/payments/verify-session", { sessionId }, requestOpts);
              if (cancelled) return;
              setOrder(res.data);
              clearStripeCheckoutResume();
              setCart([]);
              loaded = true;
              break;
            } catch (e) {
              lastErr = e;
              const st = e.response?.status;
              const msg = String(e.response?.data?.message || "");
              if (st === 503 || msg.includes("still being confirmed") || msg.includes("not in our system yet")) {
                await new Promise((r) => setTimeout(r, 1500));
                continue;
              }
              throw e;
            }
          }
          if (cancelled) return;
          if (!loaded && lastErr) throw lastErr;
        } else {
          setLoadError("Missing payment confirmation. Open this page from checkout or your confirmation email.");
        }
      } catch (e) {
        if (cancelled) return;
        setLoadError(e.response?.data?.message || e.message || "Could not load receipt.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      setLoading(false);
    };
  }, [payLater, orderIdParam, sessionId, setCart]);

  const paymentLabel = useMemo(() => {
    if (payLater) return "Pay later";
    return "Paid now — Card (Stripe)";
  }, [payLater]);

  const downloadPdf = async () => {
    if (!receiptRef.current || !order) return;
    setPdfLoading(true);
    setPdfError("");
    let blobUrls = [];
    const el = receiptRef.current;
    const imgNodes = [...el.querySelectorAll("img[data-receipt-img]")];
    const restoreReceiptImages = () => {
      imgNodes.forEach((img) => {
        const raw = img.getAttribute("data-original-url") || "";
        img.src = resolveReceiptImageUrl(raw);
      });
    };
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf")
      ]);
      blobUrls = await inlineImagesForPdf(el);
      await new Promise((r) => requestAnimationFrame(() => r()));

      const canvas = await html2canvas(el, {
        scale: 1.75,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#f8fafc",
        logging: false,
        imageTimeout: 20000,
        onclone: (clonedDoc) => injectHtml2canvasColorFix(clonedDoc)
      });

      const jpegFull = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const margin = 10;
      const pageInnerW = pdf.internal.pageSize.getWidth() - 2 * margin;
      const pageInnerH = pdf.internal.pageSize.getHeight() - 2 * margin;
      const imgDisplayW = pageInnerW;
      const imgDisplayH_mm = (canvas.height / canvas.width) * imgDisplayW;

      if (imgDisplayH_mm <= pageInnerH) {
        pdf.addImage(jpegFull, "JPEG", margin, margin, imgDisplayW, imgDisplayH_mm);
      } else {
        const pxPerPage = Math.max(1, Math.floor((canvas.height * pageInnerH) / imgDisplayH_mm));
        let yPx = 0;
        let firstPage = true;
        while (yPx < canvas.height) {
          const slicePx = Math.min(pxPerPage, canvas.height - yPx);
          const slice = document.createElement("canvas");
          slice.width = canvas.width;
          slice.height = slicePx;
          const ctx = slice.getContext("2d");
          ctx.drawImage(canvas, 0, yPx, canvas.width, slicePx, 0, 0, canvas.width, slicePx);
          const sliceMmH = (slicePx / canvas.height) * imgDisplayH_mm;
          if (!firstPage) pdf.addPage();
          pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, imgDisplayW, sliceMmH);
          firstPage = false;
          yPx += slicePx;
        }
      }

      const slug = String(order.OrderNumber || `order-${order.Id}`).replace(/[^\w-]+/g, "_");
      pdf.save(`${slug}-receipt.pdf`);
    } catch (e) {
      console.error(e);
      setPdfError(e.message || "Could not create PDF. Try Print or open this page in Chrome.");
    } finally {
      blobUrls.forEach((u) => URL.revokeObjectURL(u));
      restoreReceiptImages();
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"
          aria-hidden
        />
        <p className="text-sm text-slate-600">Loading your receipt…</p>
      </div>
    );
  }

  if (loadError || !order) {
    return (
      <section className="card mx-auto max-w-lg p-6 text-center">
        <h1 className="text-xl font-bold text-slate-900">Receipt unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">{loadError || "Something went wrong."}</p>
        <Link to="/products" className="btn-primary-on-brand mt-6 inline-block">
          Back to rentals
        </Link>
      </section>
    );
  }

  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div className="mx-auto max-w-2xl pb-10">
      <div className="mb-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
          {payLater ? "Order received" : "Payment successful"}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">Your receipt</h1>
        <p className="mt-1 text-sm text-slate-600">
          {payLater
            ? "Your booking is saved. Payment is still due — details below."
            : "Thanks — your booking is confirmed. Save or print your receipt."}
        </p>
        {pdfError ? (
          <p className="mx-auto mt-3 max-w-md rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-900">
            {pdfError}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={downloadPdf}
            disabled={pdfLoading}
            className="btn-gradient px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {pdfLoading ? "Preparing PDF…" : "Download PDF"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 print:hidden"
          >
            Print
          </button>
          <Link to="/products" className="rounded-xl px-4 py-2.5 text-sm font-semibold text-indigo-700 underline print:hidden">
            Continue shopping
          </Link>
        </div>
      </div>

      <div
        ref={receiptRef}
        id="order-receipt"
        className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl ring-1 ring-slate-100 print:shadow-none print:ring-0"
      >
        <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-5 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Kids Party Rentals</p>
              <p className="mt-1 text-lg font-bold">Rental receipt</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-mono font-semibold">{order.OrderNumber}</p>
              {order.InvoiceNumber ? (
                <p className="mt-0.5 text-xs text-white/85">Invoice {order.InvoiceNumber}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Payment</p>
              <p className="mt-1 font-semibold text-slate-900">{paymentLabel}</p>
              <p className="mt-1 text-xs text-slate-600">
                Status: {order.PaymentStatus || "—"}
                {order.PayLater ? " · Pay later reservation" : ""}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tracking</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{order.OrderNumber}</p>
              <p className="mt-1 text-xs text-slate-600">Use this number for support.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Schedule</p>
            <p className="mt-1 font-medium text-slate-900">{fmtDate(order.RentalDate)}</p>
            <p className="text-sm text-slate-600">
              {fmtTime(order.StartTime)} – {fmtTime(order.EndTime)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Delivery</p>
            <p className="mt-1 font-medium text-slate-900">{order.DeliveryMethod || "—"}</p>
            {order.DeliveryAddress ? <p className="mt-1 text-sm text-slate-600">{order.DeliveryAddress}</p> : null}
          </div>

          <div className="rounded-2xl border border-slate-100 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Contact</p>
            <p className="mt-1 font-medium text-slate-900">{order.ContactName}</p>
            {order.ContactEmail ? <p className="text-sm text-slate-600">{order.ContactEmail}</p> : null}
            {order.ContactPhone ? <p className="text-sm text-slate-600">{order.ContactPhone}</p> : null}
          </div>

          <div>
            <p className="mb-3 text-sm font-bold text-slate-900">Items</p>
            <ul className="space-y-3">
              {items.map((it) => (
                <li
                  key={it.Id}
                  className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3"
                >
                  <img
                    data-receipt-img="1"
                    data-original-url={it.ImageUrl || ""}
                    src={resolveReceiptImageUrl(it.ImageUrl)}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-slate-200/80"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{it.ItemName}</p>
                    <p className="text-xs text-slate-500">
                      Qty {it.Quantity} × {fmtMoney(it.UnitPrice)}
                      {it.PackageId != null && !it.EquipmentId ? (
                        <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
                          Package
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <p className="shrink-0 font-bold text-indigo-700">{fmtMoney(it.TotalPrice)}</p>
                </li>
              ))}
            </ul>
          </div>

          <dl className="space-y-2 border-t border-slate-100 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">Subtotal</dt>
              <dd className="font-semibold text-slate-900">{fmtMoney(order.Subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Delivery</dt>
              <dd className="font-semibold text-slate-900">{fmtMoney(order.DeliveryFee)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Tax</dt>
              <dd className="font-semibold text-slate-900">{fmtMoney(order.Tax)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
              <dt className="font-bold text-slate-900">Total</dt>
              <dd className="font-extrabold text-indigo-700">{fmtMoney(order.Total)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #order-receipt, #order-receipt * { visibility: visible; }
          #order-receipt { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
