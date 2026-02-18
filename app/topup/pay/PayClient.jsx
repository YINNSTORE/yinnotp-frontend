"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

const TTL = 12 * 60 * 60 * 1000;

function safeJson(text) {
  try {
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normBackend(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

function readLastSession() {
  try {
    const raw = localStorage.getItem("yinnotp:last_session");
    if (!raw) return null;
    const obj = JSON.parse(raw);
    const ts = Number(obj?.ts || 0);
    if (!ts || Date.now() - ts > TTL) return null;
    if (!obj?.token) return null;
    return obj;
  } catch {
    return null;
  }
}

function getActiveUserId() {
  try {
    return (
      localStorage.getItem("yinnotp_user_id") ||
      localStorage.getItem("yinnotp_active_user") ||
      localStorage.getItem("yinnotp_username") ||
      localStorage.getItem("user_id") ||
      localStorage.getItem("username") ||
      readLastSession()?.username ||
      ""
    );
  } catch {
    return "";
  }
}

function getToken() {
  try {
    const s = readLastSession();
    if (s?.token) return String(s.token);
    return String(localStorage.getItem("yinnotp_token") || "");
  } catch {
    return "";
  }
}

function authHeaders(uid, token) {
  const h = { "Content-Type": "application/json" };
  if (uid) h["X-User-Id"] = uid;
  if (token) {
    h["Authorization"] = `Bearer ${token}`;
    h["X-Token"] = token;
  }
  return h;
}

function pickStatus(j) {
  const raw =
    j?.status ??
    j?.transaction?.status ??
    j?.data?.status ??
    j?.data?.transaction?.status ??
    j?.payment?.status ??
    j?.data?.payment?.status ??
    "";

  const s = String(raw || "").toLowerCase();
  if (["completed", "paid", "success", "settlement", "done"].includes(s)) return "completed";
  if (["pending", "process", "processing", "waiting", "unpaid"].includes(s)) return "pending";
  if (["failed", "expired", "expire", "cancel", "canceled", "cancelled"].includes(s)) return "failed";
  return s || "pending";
}

function pickAmount(j, fallback = 0) {
  const a = j?.amount ?? j?.transaction?.amount ?? j?.payment?.amount ?? j?.data?.amount ?? j?.data?.payment?.amount;
  const n = Number(a || 0) || 0;
  return n || Number(fallback || 0) || 0;
}

function pickFee(j) {
  const f = j?.fee ?? j?.payment?.fee ?? j?.data?.fee ?? j?.data?.payment?.fee;
  return Number(f || 0) || 0;
}

function pickTotal(j, fallback = 0) {
  const t =
    j?.total_payment ??
    j?.payment?.total_payment ??
    j?.data?.total_payment ??
    j?.data?.payment?.total_payment;
  const n = Number(t || 0) || 0;
  return n || Number(fallback || 0) || 0;
}

function pickPaymentNumber(j) {
  // backend kamu: payment.payment_number (string QR)
  return (
    j?.payment_number ||
    j?.payment?.payment_number ||
    j?.data?.payment_number ||
    j?.data?.payment?.payment_number ||
    j?.payment?.qr_string ||
    j?.data?.payment?.qr_string ||
    j?.qr ||
    j?.qr_image ||
    j?.qr_url ||
    j?.data?.qr ||
    j?.data?.qr_image ||
    j?.data?.qr_url ||
    ""
  );
}

async function toQrDataUrl(value) {
  // kalau value sudah URL gambar (http/data:image) => return apa adanya
  const v = String(value || "");
  if (!v) return "";
  if (v.startsWith("data:image/")) return v;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;

  // kalau string QR => render jadi PNG dataURL
  const QRCode = (await import("qrcode")).default;
  return await QRCode.toDataURL(v, { errorCorrectionLevel: "M", margin: 1, scale: 8 });
}

export default function PayClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const backend = useMemo(() => normBackend(process.env.NEXT_PUBLIC_BACKEND_URL), []);

  const method = sp.get("method") || "qris";
  const amountParam = sp.get("amount") || "0";
  const order_id = sp.get("order_id") || "";
  const resume = sp.get("resume") === "1";

  const uid = useMemo(() => (typeof window === "undefined" ? "" : getActiveUserId()), []);
  const token = useMemo(() => (typeof window === "undefined" ? "" : getToken()), []);

  const isLoggedIn = Boolean(uid && token);
  const headers = useMemo(() => authHeaders(uid, token), [uid, token]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [qrUrl, setQrUrl] = useState(""); // dataUrl / image url
  const [qrRaw, setQrRaw] = useState(""); // string QR (optional)
  const [status, setStatus] = useState("pending");
  const [fee, setFee] = useState(0);

  const [amount, setAmount] = useState(Number(amountParam || 0) || 0);
  const [total, setTotal] = useState(Number(amountParam || 0) || 0);

  const confirmedRef = useRef(false);
  const toastErrOnceRef = useRef(false);
  const timerRef = useRef(null);

  const cacheKey = useMemo(() => (uid && order_id ? `deposit_qr:${uid}:${order_id}` : ""), [uid, order_id]);

  function stopPolling() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function syncMeAfterSuccess() {
    if (!backend || !uid) return;
    try {
      const r = await fetch(`${backend}/deposit/me.php?user_id=${encodeURIComponent(uid)}`, {
        cache: "no-store",
        headers,
      });
      const t = await r.text();
      const j = safeJson(t);
      if (!r.ok || !j?.ok) return;

      const bal = Number(j.balance || 0) || 0;
      const hist = Array.isArray(j.history) ? j.history : [];

      localStorage.setItem(`yinnotp_balance:${uid}`, String(bal));
      localStorage.setItem(`yinnotp_deposit_history:${uid}`, JSON.stringify(hist));
      localStorage.setItem(`yinnotp_last_sync:${uid}`, String(Date.now()));

      // legacy
      localStorage.setItem("yinnotp_balance", String(bal));
      localStorage.setItem("yinnotp_deposit_history", JSON.stringify(hist));
    } catch {}
  }

  async function createTx() {
    if (!backend) throw new Error("Backend URL belum diset");
    if (!uid || !token) throw new Error("Session user tidak ketemu. Login dulu ya.");
    if (!order_id) throw new Error("Order ID kosong");

    const body = {
      user_id: uid,
      order_id,
      method,
      amount: Number(amountParam || 0) || 0,
    };

    const r = await fetch(`${backend}/deposit/create.php`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const t = await r.text();
    const j = safeJson(t);
    if (!r.ok || !j?.ok) throw new Error(String(j?.message || "Gagal buat transaksi"));

    const st = pickStatus(j);
    const a = pickAmount(j, body.amount);
    const f = pickFee(j);
    const tp = pickTotal(j, a);
    const payNum = pickPaymentNumber(j);

    setStatus(st);
    setAmount(a);
    setFee(f);
    setTotal(tp);

    if (!payNum) throw new Error("QR belum tersedia (payment_number kosong)");

    setQrRaw(String(payNum));
    const url = await toQrDataUrl(payNum);
    setQrUrl(url);

    if (cacheKey) {
      try {
        localStorage.setItem(cacheKey, url);
        localStorage.setItem(`${cacheKey}:raw`, String(payNum));
      } catch {}
    }

    return j;
  }

  async function getDetail() {
    if (!backend || !order_id) return null;

    // NOTE: backend kamu detail.php minimal butuh order_id
    const u = `${backend}/deposit/detail.php?order_id=${encodeURIComponent(order_id)}${
      uid ? `&user_id=${encodeURIComponent(uid)}` : ""
    }`;

    const r = await fetch(u, { cache: "no-store", headers });
    const t = await r.text();
    const j = safeJson(t);
    if (!r.ok || !j) return null;
    return j;
  }

  async function confirmIfCompleted() {
    if (confirmedRef.current) return;
    confirmedRef.current = true;

    try {
      const r = await fetch(`${backend}/deposit/confirm.php`, {
        method: "POST",
        headers,
        body: JSON.stringify({ user_id: uid, order_id }),
      });
      const t = await r.text();
      const j = safeJson(t);

      if (!r.ok || !j?.ok) {
        confirmedRef.current = false;
        throw new Error(String(j?.message || "Gagal konfirmasi deposit"));
      }

      await syncMeAfterSuccess();
      toast.success("Deposit sukses ✅", { id: "dep-ok" });

      stopPolling();
      router.replace(
        `/topup/success?order_id=${encodeURIComponent(order_id)}&amount=${encodeURIComponent(String(amount || amountParam || 0))}`
      );
    } catch (e) {
      toast.error(String(e?.message || "Gagal konfirmasi deposit"), { id: "dep-confirm-fail" });
    }
  }

  async function ensureQR() {
    setErr("");
    setLoading(true);

    // 1) resume: pakai cache QR dulu biar instan
    if (resume && cacheKey) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) setQrUrl(cached);
        const raw = localStorage.getItem(`${cacheKey}:raw`);
        if (raw) setQrRaw(raw);
      } catch {}
    }

    try {
      // 2) coba detail dulu
      const d = await getDetail();
      const st = pickStatus(d);
      setStatus(st);

      const a = pickAmount(d, Number(amountParam || 0));
      const f = pickFee(d);
      const tp = pickTotal(d, a);

      setAmount(a);
      setFee(f);
      setTotal(tp);

      const payNum = pickPaymentNumber(d);

      if (payNum) {
        setQrRaw(String(payNum));
        const url = await toQrDataUrl(payNum);
        setQrUrl(url);
        if (cacheKey) {
          try {
            localStorage.setItem(cacheKey, url);
            localStorage.setItem(`${cacheKey}:raw`, String(payNum));
          } catch {}
        }
      } else if (!qrUrl) {
        // 3) kalau detail belum punya QR => create
        await createTx();
      }

      setLoading(false);
      return true;
    } catch (e) {
      setLoading(false);
      setErr(String(e?.message || "Gagal memuat pembayaran"));
      return false;
    }
  }

  function startPolling() {
    stopPolling();
    timerRef.current = setInterval(async () => {
      try {
        const d = await getDetail();
        const st = pickStatus(d);
        if (st) setStatus(st);

        if (st === "completed") {
          await confirmIfCompleted();
        }
      } catch {
        // silent
      }
    }, 3000);
  }

  async function downloadQR() {
    try {
      if (!qrUrl) return toast.error("QR belum siap");
      const a = document.createElement("a");
      a.href = qrUrl;
      a.download = `${order_id || "qris"}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("QRIS berhasil didownload ✅");
    } catch {
      toast.error("Gagal download QR");
    }
  }

  useEffect(() => {
    if (!order_id) {
      router.replace("/topup");
      return;
    }

    if (!isLoggedIn) {
      setLoading(false);
      setErr("Session user tidak ketemu. Login dulu ya.");
      return;
    }

    let unmounted = false;

    (async () => {
      const ok = await ensureQR();

      if (!ok || unmounted) {
        if (!toastErrOnceRef.current && err) {
          toastErrOnceRef.current = true;
          toast.error(err, { id: "pay-load-fail" });
        }
        return;
      }

      startPolling();
    })();

    return () => {
      unmounted = true;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order_id]);

  return (
    <div className="min-h-screen bg-[var(--yinn-bg)] text-[var(--yinn-text)] px-4 py-8">
      <Toaster position="top-right" />

      <div className="mx-auto max-w-[520px]">
        <div
          className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] p-5"
          style={{ boxShadow: "var(--yinn-soft)" }}
        >
          <div className="text-lg font-extrabold">Deposit via QRIS</div>

          <div className="mt-2 text-sm text-[var(--yinn-muted)] break-words">
            Order ID: <span className="font-semibold">{order_id}</span>
          </div>

          <div className="text-sm text-[var(--yinn-muted)]">
            Nominal: <span className="font-semibold">Rp {Number(amount || 0).toLocaleString("id-ID")}</span>
          </div>

          <div className="text-sm text-[var(--yinn-muted)]">
            Fee: <span className="font-semibold">Rp {Number(fee || 0).toLocaleString("id-ID")}</span>
          </div>

          <div className="text-sm text-[var(--yinn-muted)]">
            Total: <span className="font-semibold">Rp {Number(total || 0).toLocaleString("id-ID")}</span>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--yinn-border)] p-4">
            {err ? (
              <>
                <div className="text-sm font-extrabold">Gagal</div>
                <div className="mt-1 text-sm text-[var(--yinn-muted)]">{err}</div>
                <div className="mt-3 flex gap-2">
                  <Link
                    href="/login"
                    className="rounded-xl px-4 py-2 text-sm font-extrabold text-white"
                    style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
                  >
                    Login
                  </Link>
                  <button
                    onClick={() => ensureQR()}
                    className="rounded-xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] px-4 py-2 text-sm font-bold"
                  >
                    Coba lagi
                  </button>
                </div>
              </>
            ) : loading ? (
              <div className="text-sm font-bold text-[var(--yinn-muted)]">Menyiapkan pembayaran…</div>
            ) : qrUrl ? (
              <div className="grid place-items-center gap-3">
                <div className="text-sm font-bold">Scan QR di bawah</div>

                {/* QR Box + hologram vibe */}
                <div
                  className="relative overflow-hidden rounded-2xl border border-[var(--yinn-border)] p-4"
                  style={{
                    background:
                      "radial-gradient(1200px 400px at 10% 10%, rgba(99,102,241,.16), transparent 60%), radial-gradient(1200px 400px at 90% 30%, rgba(56,189,248,.14), transparent 55%), linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,0))",
                  }}
                >
                  <div
                    className="pointer-events-none absolute inset-0 opacity-70"
                    style={{
                      background:
                        "linear-gradient(115deg, rgba(255,0,255,.10), rgba(0,255,255,.08), rgba(255,255,0,.08)), radial-gradient(900px 200px at 20% 20%, rgba(255,255,255,.25), transparent 60%)",
                      mixBlendMode: "screen",
                      filter: "blur(0.2px)",
                    }}
                  />
                  <div
                    className="pointer-events-none absolute -inset-24 opacity-40"
                    style={{
                      background:
                        "repeating-linear-gradient(45deg, rgba(255,255,255,.18) 0px, rgba(255,255,255,.18) 2px, transparent 2px, transparent 10px)",
                      transform: "rotate(10deg)",
                    }}
                  />

                  <div className="relative grid place-items-center">
                    <div className="rounded-2xl bg-white p-4 shadow-[0_20px_60px_rgba(2,6,23,.18)]">
                      <img src={qrUrl} alt="QRIS" className="block h-auto w-[260px] max-w-full" />
                    </div>
                  </div>
                </div>

                <div className="text-xs text-[var(--yinn-muted)]">
                  Status: <span className="font-semibold">{String(status || "pending").toUpperCase()}</span> • auto-check 3 detik
                </div>

                <div className="grid w-full grid-cols-2 gap-2">
                  <button
                    onClick={downloadQR}
                    className="rounded-2xl py-3 text-sm font-extrabold text-white"
                    style={{ background: "linear-gradient(135deg, var(--yinn-brand-from), var(--yinn-brand-to))" }}
                  >
                    Download QRIS
                  </button>

                  <button
                    onClick={() => confirmIfCompleted()}
                    className="rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] py-3 text-sm font-extrabold"
                  >
                    Saya sudah membayar
                  </button>
                </div>

                <Link
                  href="/topup"
                  className="w-full rounded-2xl border border-[var(--yinn-border)] bg-[var(--yinn-surface)] py-3 text-center text-sm font-bold"
                >
                  Balik ke Deposit
                </Link>

                {/* Debug kecil kalau perlu */}
                {qrRaw ? (
                  <div className="mt-2 w-full break-all text-[10px] text-[var(--yinn-muted)]">
                    QR Raw: {qrRaw.slice(0, 80)}...
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-sm font-bold text-[var(--yinn-muted)]">
                QR belum tersedia. Coba lagi.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}